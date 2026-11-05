package bd.com.dakly.app.data

import android.net.Uri
import bd.com.dakly.app.util.Format
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File

/** Every call the app makes, in one place. ViewModels talk to this, never to HTTP directly. */
class Repository(private val api: ApiClient, private val session: SessionStore) {

    val token: Flow<String?> = session.token
    val loggedOut = api.loggedOut
    val baseUrl: String get() = api.baseUrl.toString().trimEnd('/')

    private val _me = MutableStateFlow<Me?>(null)
    /** The signed-in user and shop, refreshed on start and after settings changes. */
    val me: StateFlow<Me?> = _me

    private fun applyLocale(country: String?, currency: String?, tz: String?) = Format.configure(country, currency, tz)

    // ------------------------------------------------------------ auth

    suspend fun login(email: String, password: String) {
        val r = api.send("POST", "api/v1/auth/login", LoginBody(email.trim(), password), LoginBody.serializer(), TokenResponse.serializer())
        session.save(r.token)
        loadMe()
    }

    suspend fun register(body: RegisterBody) {
        val r = api.send("POST", "api/v1/auth/register", body, RegisterBody.serializer(), TokenResponse.serializer())
        session.save(r.token)
        loadMe()
    }

    /** From the emailed /reset?token= link: sets the new password and signs in. */
    suspend fun resetPassword(token: String, password: String) {
        val r = api.send("POST", "api/v1/auth/reset", ResetBody(token, password), ResetBody.serializer(), TokenResponse.serializer())
        session.save(r.token)
        loadMe()
    }

    /** Other devices are signed out; this device keeps working with the new token. */
    suspend fun changePassword(current: String, password: String) {
        val r = api.send("POST", "api/v1/auth/password", ChangePasswordBody(current, password), ChangePasswordBody.serializer(), TokenResponse.serializer())
        if (r.token.isNotBlank()) session.save(r.token)
    }

    suspend fun forgot(email: String): Ok =
        api.send("POST", "api/v1/auth/forgot", EmailBody(email.trim()), EmailBody.serializer(), Ok.serializer())

    /** Called on app start: gets a fresh 60-day token so active users never get logged out. */
    suspend fun refresh() {
        if (session.current() == null) return
        val r = api.sendJson("POST", "api/v1/auth/refresh", null, TokenResponse.serializer())
        if (r.token.isNotBlank()) session.save(r.token)
    }

    suspend fun logout() {
        runCatching { api.sendJson("POST", "api/v1/auth/logout", null, Ok.serializer()) }
        session.clear()
        _me.value = null
    }

    suspend fun isLoggedIn(): Boolean = session.current() != null

    suspend fun loadMe(): Me {
        val m = api.get("api/v1/me", Me.serializer())
        applyLocale(m.shop.country, m.shop.currency, m.shop.timezone)
        _me.value = m
        return m
    }

    suspend fun status(): ShopStatus = api.get("api/v1/status", ShopStatus.serializer())

    suspend fun updateMe(patch: MePatch): Ok = api.send("PATCH", "api/v1/me", patch, MePatch.serializer(), Ok.serializer())

    suspend fun deleteAccount(password: String) {
        api.send("DELETE", "api/v1/me", PasswordBody(password), PasswordBody.serializer(), Ok.serializer())
        session.clear()
        _me.value = null
    }

    // ------------------------------------------------------------ dashboard

    suspend fun dashboard(): Dashboard =
        api.get("api/v1/dashboard", Dashboard.serializer()).also { applyLocale(it.country, it.currency, it.timezone) }

    suspend fun insights(refresh: Boolean = false): Insights =
        api.get("api/v1/insights", Insights.serializer(), mapOf("refresh" to if (refresh) 1 else null))

    suspend fun dismiss(key: String): Ok = api.send("POST", "api/v1/insights/dismiss", KeyBody(key), KeyBody.serializer(), Ok.serializer())

    // ------------------------------------------------------------ customers

    suspend fun customers(q: String?, segment: String?, sort: String, page: Int): CustomerPage =
        api.get(
            "api/v1/customers", CustomerPage.serializer(),
            mapOf("q" to q, "segment" to segment, "sort" to sort, "page" to page, "pageSize" to 50),
        )

    suspend fun customer(id: String): CustomerDetail = api.get("api/v1/customers/$id", CustomerDetail.serializer())

    suspend fun addCustomer(c: NewCustomer): Created =
        api.send("POST", "api/v1/customers", c, NewCustomer.serializer(), Created.serializer())

    suspend fun updateCustomer(id: String, p: CustomerPatch): Ok =
        api.send("PATCH", "api/v1/customers/$id", p, CustomerPatch.serializer(), Ok.serializer())

    suspend fun deleteCustomer(id: String): Ok = api.delete("api/v1/customers/$id", Ok.serializer())

    suspend fun addOrder(id: String, o: NewOrder): Created =
        api.send("POST", "api/v1/customers/$id/orders", o, NewOrder.serializer(), Created.serializer())

    /** Records a call/WhatsApp contact made from the phone, so it shows in the customer's conversation. */
    suspend fun logCall(id: String, how: String, note: String? = null): Created =
        api.send("POST", "api/v1/customers/$id/calls", CallLog(how, note = note), CallLog.serializer(), Created.serializer())

    /** All customers as a CSV file in the app cache, ready to share. */
    suspend fun exportCustomers(dir: File): File {
        val (name, bytes) = api.download("api/v1/customers/export")
        dir.mkdirs()
        dir.listFiles()?.forEach { it.delete() }
        val safe = (name ?: "dakly-customers.csv").replace(Regex("[^A-Za-z0-9._-]"), "_")
        return File(dir, safe).also { it.writeBytes(bytes) }
    }

    suspend fun importPreview(uri: Uri, name: String, mime: String): ImportPreview =
        api.upload("api/v1/customers/import", "file", name, mime, api.readUri(uri), emptyMap(), ImportPreview.serializer(), mapOf("dry" to 1))

    suspend fun importCustomers(uri: Uri, name: String, mime: String): ImportResult =
        api.upload("api/v1/customers/import", "file", name, mime, api.readUri(uri), emptyMap(), ImportResult.serializer())

    suspend fun voice(file: File, mime: String): VoiceResult =
        api.upload("api/v1/customers/voice", "audio", file.name, mime, api.readFile(file), emptyMap(), VoiceResult.serializer())

    // ------------------------------------------------------------ campaigns

    suspend fun audience(): Audience = api.get("api/v1/campaigns/audience", Audience.serializer())

    suspend fun aiMessage(segment: String, offer: String, channel: String): AiText =
        api.send("POST", "api/v1/ai/message", AiMessageBody(segment, offer, channel), AiMessageBody.serializer(), AiText.serializer())

    suspend fun campaigns(): CampaignList = api.get("api/v1/campaigns", CampaignList.serializer())

    suspend fun campaign(id: String): CampaignDetail = api.get("api/v1/campaigns/$id", CampaignDetail.serializer())

    suspend fun createCampaign(c: NewCampaign): Created =
        api.send("POST", "api/v1/campaigns", c, NewCampaign.serializer(), Created.serializer())

    // ------------------------------------------------------------ posts

    suspend fun aiPost(prompt: String, tone: String): AiText =
        api.send("POST", "api/v1/ai/post", AiPostBody(prompt, tone), AiPostBody.serializer(), AiText.serializer())

    suspend fun posts(): PostList = api.get("api/v1/posts", PostList.serializer())

    suspend fun schedulePost(p: NewPost): Created = api.send("POST", "api/v1/posts", p, NewPost.serializer(), Created.serializer())

    suspend fun cancelPost(id: String): Ok = api.delete("api/v1/posts/$id", Ok.serializer())

    // ------------------------------------------------------------ knowledge

    suspend fun knowledge(q: String?, type: String?): KnowledgeList =
        api.get("api/v1/knowledge", KnowledgeList.serializer(), mapOf("q" to q, "type" to type))

    suspend fun knowledgeItem(id: String): Knowledge = api.get("api/v1/knowledge/$id", Knowledge.serializer())

    suspend fun addKnowledge(k: KnowledgeBody): Created =
        api.send("POST", "api/v1/knowledge", k, KnowledgeBody.serializer(), Created.serializer())

    suspend fun updateKnowledge(id: String, k: KnowledgeBody): Created =
        api.send("PATCH", "api/v1/knowledge/$id", k, KnowledgeBody.serializer(), Created.serializer())

    suspend fun setKnowledgeActive(id: String, active: Boolean): Created =
        api.send("PATCH", "api/v1/knowledge/$id", ActiveBody(active), ActiveBody.serializer(), Created.serializer())

    suspend fun deleteKnowledge(id: String): Ok = api.delete("api/v1/knowledge/$id", Ok.serializer())

    suspend fun setBrandVoice(text: String): Ok = patchSettings(buildJsonObject { put("brandVoice", text) })

    // ------------------------------------------------------------ inbox

    suspend fun inbox(q: String?, unreadOnly: Boolean, before: String?): InboxPage =
        api.get("api/v1/inbox", InboxPage.serializer(), mapOf("q" to q, "unread" to if (unreadOnly) 1 else null, "before" to before, "limit" to 30))

    suspend fun thread(customerId: String, before: String? = null): Thread =
        api.get("api/v1/inbox/$customerId", Thread.serializer(), mapOf("before" to before, "limit" to 50))

    suspend fun sendMessage(customerId: String, text: String, channel: String? = null): SendResult =
        api.send("POST", "api/v1/inbox/$customerId", SendBody(text, channel), SendBody.serializer(), SendResult.serializer())

    suspend fun markRead(customerId: String): Ok = api.sendJson("POST", "api/v1/inbox/$customerId/read", null, Ok.serializer())

    suspend fun suggestReply(customerId: String): AiText =
        api.sendJson("POST", "api/v1/inbox/$customerId/suggest", null, AiText.serializer())

    // ------------------------------------------------------------ settings

    suspend fun settings(): Settings = api.get("api/v1/settings", Settings.serializer()).also {
        applyLocale(it.profile.country, it.profile.currency, it.profile.timezone)
    }

    suspend fun patchSettings(fields: JsonObject): Ok {
        val r = api.sendJson("PATCH", "api/v1/settings", fields, Ok.serializer())
        runCatching { loadMe() }
        return r
    }

    fun fields(vararg pairs: Pair<String, Any?>): JsonObject = buildJsonObject {
        pairs.forEach { (k, v) ->
            when (v) {
                null -> {}
                is String -> put(k, v)
                is Boolean -> put(k, v)
                is Number -> put(k, JsonPrimitive(v))
                else -> put(k, v.toString())
            }
        }
    }

    suspend fun connectStore(b: StoreBody): Ok = api.send("POST", "api/v1/settings/store", b, StoreBody.serializer(), Ok.serializer())
    suspend fun syncStore(): Ok = api.sendJson("POST", "api/v1/settings/store/sync", null, Ok.serializer())
    suspend fun disconnectStore(): Ok = api.delete("api/v1/settings/store", Ok.serializer())

    suspend fun facebook(): FacebookState = api.get("api/v1/settings/facebook", FacebookState.serializer())
    suspend fun choosePage(pageId: String): Ok =
        api.send("POST", "api/v1/settings/facebook/page", PageBody(pageId), PageBody.serializer(), Ok.serializer())
    suspend fun disconnectFacebook(): Ok = api.delete("api/v1/settings/facebook", Ok.serializer())

    // ------------------------------------------------------------ billing / support

    suspend fun billing(): Billing = api.get("api/v1/billing", Billing.serializer())
    suspend fun checkout(plan: String, months: Int): UrlResponse =
        api.send("POST", "api/v1/billing/checkout", CheckoutBody(plan, months), CheckoutBody.serializer(), UrlResponse.serializer())

    suspend fun tickets(): TicketList = api.get("api/v1/tickets", TicketList.serializer())
    suspend fun openTicket(subject: String, body: String): Created =
        api.send("POST", "api/v1/tickets", TicketBody(subject, body), TicketBody.serializer(), Created.serializer())

}
