package bd.com.dakly.app.ui

import android.content.Context
import android.widget.Toast
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import bd.com.dakly.app.R
import bd.com.dakly.app.data.ApiException
import bd.com.dakly.app.data.OfflineException
import bd.com.dakly.app.data.Repository
import bd.com.dakly.app.ui.components.Load

val LocalRepo = staticCompositionLocalOf<Repository> { error("Repository not provided") }

/** Loader handle returned by [rememberLoad]. */
class Loader<T>(val state: MutableState<Load<T>>, private val bump: () -> Unit) {
    val value: Load<T> get() = state.value
    fun reload() = bump()
    fun data(): T? = (state.value as? Load.Ready<T>)?.data
    fun set(data: T) { state.value = Load.Ready(data) }
}

/**
 * Loads data for a screen and reloads when [keys] change or [Loader.reload] is called.
 * Keeps showing old data while refreshing, so lists don't flash.
 */
@Composable
fun <T> rememberLoad(vararg keys: Any?, block: suspend () -> T): Loader<T> {
    val state = remember { mutableStateOf<Load<T>>(Load.Loading) }
    var tick by remember { mutableIntStateOf(0) }
    LaunchedEffect(*keys, tick) {
        val old = state.value
        if (old is Load.Ready) state.value = old.copy(refreshing = true)
        state.value = try {
            Load.Ready(block())
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            if (old is Load.Ready) {
                old.copy(refreshing = false)
            } else Load.Failed(e)
        }
    }
    return remember(state) { Loader(state) { tick++ } }
}

fun Context.toast(text: String) = Toast.makeText(this, text, Toast.LENGTH_LONG).show()

fun Context.errorMessage(e: Throwable): String = when (e) {
    is OfflineException -> getString(R.string.offline_body)
    is ApiException -> e.message
    else -> e.message ?: getString(R.string.error_body)
}

fun Context.toastError(e: Throwable) = toast(errorMessage(e))

/** Segment key -> label resource. */
fun segmentLabel(key: String?): Int = when (key) {
    "vip" -> R.string.seg_vip
    "regular" -> R.string.seg_regular
    "new" -> R.string.seg_new
    "inactive" -> R.string.seg_inactive
    else -> R.string.seg_all
}

fun segmentHint(key: String?): Int = when (key) {
    "vip" -> R.string.seg_vip_hint
    "regular" -> R.string.seg_regular_hint
    "new" -> R.string.seg_new_hint
    "inactive" -> R.string.seg_inactive_hint
    else -> R.string.seg_all_hint
}

fun statusLabel(status: String?): Int = when (status) {
    "draft" -> R.string.st_draft
    "scheduled" -> R.string.st_scheduled
    "queuing", "queued" -> R.string.st_queued
    "sending" -> R.string.st_sending
    "sent" -> R.string.st_sent
    "delivered" -> R.string.st_delivered
    "read" -> R.string.st_read
    "interested" -> R.string.st_interested
    "failed" -> R.string.st_failed
    "test" -> R.string.st_test
    "skipped" -> R.string.st_skipped
    "published" -> R.string.st_published
    "received" -> R.string.st_received
    else -> R.string.st_unknown
}

fun channelLabel(c: String?): Int = when (c) {
    "wa" -> R.string.ch_whatsapp
    "sms" -> R.string.ch_sms
    "voice" -> R.string.ch_voice
    "call" -> R.string.ch_call
    else -> R.string.ch_whatsapp
}
