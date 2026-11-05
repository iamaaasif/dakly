package bd.com.dakly.app.data

import android.content.Context
import android.net.Uri
import androidx.core.os.ConfigurationCompat
import bd.com.dakly.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** A failed API call. [code] is the server's machine code (e.g. "unauthorized"), [message] is already localized. */
class ApiException(val status: Int, val code: String?, override val message: String) : Exception(message)

/** No connection, DNS failure or timeout. */
/**
 * The request never got an HTTP answer. [deviceOnline] tells the two cases apart:
 * false = the phone has no working internet; true = the internet works but the Dakly server at [host]
 * could not be reached (server down, wrong address in the build, DNS or TLS problem).
 */
class OfflineException(cause: Throwable, val deviceOnline: Boolean = false, val host: String = "") : IOException(cause)

val DaklyJson = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    coerceInputValues = true
    encodeDefaults = true
}

/**
 * Thin JSON-over-HTTPS client for the Dakly /api/v1 REST API.
 * Sends the Bearer token, the app language (Accept-Language) and an app User-Agent.
 */
class ApiClient(context: Context, base: String, private val session: SessionStore) {
    private val appContext = context.applicationContext
    val baseUrl: HttpUrl = base.trimEnd('/').toHttpUrl()

    /** Emits when the server says the token is no longer valid, so the UI can return to login. */
    private val _loggedOut = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val loggedOut: SharedFlow<Unit> = _loggedOut

    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS) // AI generation can take a while
        .writeTimeout(60, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .apply {
            if (BuildConfig.DEBUG) {
                addInterceptor(okhttp3.logging.HttpLoggingInterceptor().apply {
                    level = okhttp3.logging.HttpLoggingInterceptor.Level.BASIC
                })
            }
        }
        .build()

    fun url(path: String, query: Map<String, Any?> = emptyMap()): HttpUrl {
        val b = baseUrl.newBuilder()
        path.trimStart('/').split('/').filter { it.isNotEmpty() }.forEach { b.addPathSegment(it) }
        query.forEach { (k, v) -> if (v != null && v.toString().isNotEmpty()) b.addQueryParameter(k, v.toString()) }
        return b.build()
    }

    private fun language(): String {
        val locales = ConfigurationCompat.getLocales(appContext.resources.configuration)
        val lang = if (locales.isEmpty) "en" else locales[0]!!.language
        return if (lang == "bn") "bn, en;q=0.5" else "$lang, en;q=0.5"
    }

    private suspend fun build(url: HttpUrl, method: String, body: RequestBody?): Request {
        val b = Request.Builder().url(url).method(method, body)
            .header("Accept", "application/json")
            .header("Accept-Language", language())
            .header("User-Agent", "DaklyAndroid/${BuildConfig.VERSION_NAME} (Android ${android.os.Build.VERSION.RELEASE})")
        session.current()?.let { b.header("Authorization", "Bearer $it") }
        return b.build()
    }

    suspend fun <T> get(path: String, serializer: KSerializer<T>, query: Map<String, Any?> = emptyMap()): T =
        call(build(url(path, query), "GET", null), serializer)

    suspend fun <T, B> send(method: String, path: String, body: B?, bodySerializer: KSerializer<B>, serializer: KSerializer<T>): T {
        val rb = (if (body == null) "{}" else DaklyJson.encodeToString(bodySerializer, body)).toRequestBody(JSON)
        return call(build(url(path), method, rb), serializer)
    }

    suspend fun <T> sendJson(method: String, path: String, json: JsonObject?, serializer: KSerializer<T>): T {
        val rb = (json?.toString() ?: "{}").toRequestBody(JSON)
        return call(build(url(path), method, rb), serializer)
    }

    suspend fun <T> delete(path: String, serializer: KSerializer<T>): T =
        call(build(url(path), "DELETE", null), serializer)

    /** Multipart upload of a content:// Uri (Excel/CSV) or a file (voice recording). */
    suspend fun <T> upload(
        path: String,
        field: String,
        fileName: String,
        mime: String,
        bytes: ByteArray,
        extra: Map<String, String>,
        serializer: KSerializer<T>,
        query: Map<String, Any?> = emptyMap(),
    ): T {
        val mb = MultipartBody.Builder().setType(MultipartBody.FORM)
        extra.forEach { (k, v) -> mb.addFormDataPart(k, v) }
        mb.addFormDataPart(field, fileName, bytes.toRequestBody(mime.toMediaType()))
        return call(build(url(path, query), "POST", mb.build()), serializer)
    }

    suspend fun readUri(uri: Uri): ByteArray = withContext(Dispatchers.IO) {
        appContext.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: throw IOException("Cannot read file")
    }

    suspend fun readFile(file: File): ByteArray = withContext(Dispatchers.IO) { file.readBytes() }

    private suspend fun <T> call(request: Request, serializer: KSerializer<T>): T = withContext(Dispatchers.IO) {
        val response = try {
            http.newCall(request).await()
        } catch (e: IOException) {
            throw OfflineException(e, deviceOnline(), baseUrl.host)
        }
        response.use { r ->
            val text = r.body?.string().orEmpty()
            if (!r.isSuccessful) {
                if (r.code == 401) {
                    session.clear()
                    _loggedOut.tryEmit(Unit)
                }
                throw parseError(r.code, text)
            }
            if (text.isBlank()) DaklyJson.decodeFromString(serializer, "{}")
            else DaklyJson.decodeFromString(serializer, text)
        }
    }

    private fun parseError(status: Int, text: String): ApiException {
        val obj = runCatching { DaklyJson.parseToJsonElement(text).jsonObject }.getOrNull()
        val code = obj?.get("code")?.jsonPrimitive?.contentOrNull
        val msg = obj?.get("error")?.let { runCatching { it.jsonPrimitive.contentOrNull }.getOrNull() }
            ?: obj?.get("message")?.jsonPrimitive?.contentOrNull
            ?: "HTTP $status"
        return ApiException(status, code, msg)
    }

    private suspend fun Call.await(): Response = suspendCancellableCoroutine { cont ->
        enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) = cont.resume(response)
            override fun onFailure(call: Call, e: IOException) {
                if (!cont.isCancelled) cont.resumeWithException(e)
            }
        })
        cont.invokeOnCancellation { runCatching { cancel() } }
    }

    /** True when Android reports a network that has passed its internet check (Wi-Fi or mobile data). */
    private fun deviceOnline(): Boolean = runCatching {
        val cm = appContext.getSystemService(android.net.ConnectivityManager::class.java) ?: return true
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }.getOrDefault(true)

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()
    }
}
