package bd.com.dakly.app

import androidx.test.core.app.ApplicationProvider
import bd.com.dakly.app.data.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.StructureKind
import kotlinx.serialization.json.*
import okhttp3.OkHttpClient
import okhttp3.Request
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.FixMethodOrder
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters
import org.robolectric.RobolectricTestRunner
import java.io.File

/**
 * Runs every Repository call against a real Dakly backend (seeded demo shop) and checks that the
 * JSON the server sends has every field the app's models read. Run with -PdaklyApi=http://localhost:3000.
 */
@RunWith(RobolectricTestRunner::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class ApiContractTest {
    private val app = ApplicationProvider.getApplicationContext<DaklyApp>()
    private val repo get() = app.repo
    private val base = BuildConfig.API_BASE.trimEnd('/')
    private val report = File("build/reports/api-contract.txt")

    private fun live() = assumeTrue("set -PdaklyApi to a running backend", base.startsWith("http://localhost") || base.startsWith("http://127."))

    private fun login() = loginDemo()

    private fun raw(path: String): JsonElement = runBlocking {
        val token = app.session.current()
        val r = OkHttpClient().newCall(Request.Builder().url("$base/$path").header("Authorization", "Bearer $token").build()).execute()
        val body = r.body!!.string()
        assertTrue("GET $path -> ${r.code}: $body", r.isSuccessful)
        Json.parseToJsonElement(body)
    }

    /** Model fields the server never sends (likely a name mismatch) and server fields the app ignores. */
    private fun diff(path: String, d: SerialDescriptor, e: JsonElement, out: MutableList<String>, where: String = "") {
        when (d.kind) {
            StructureKind.CLASS -> {
                val o = e as? JsonObject ?: return
                for (i in 0 until d.elementsCount) {
                    val name = d.getElementName(i)
                    val v = o[name]
                    if (v == null) out += "MISSING  $path $where.$name (app reads it, server does not send it)"
                    else if (v !is JsonNull) diff(path, d.getElementDescriptor(i), v, out, "$where.$name")
                }
                val known = (0 until d.elementsCount).map { d.getElementName(it) }.toSet()
                o.keys.filter { it !in known }.forEach { out += "unused   $path $where.$it" }
            }
            StructureKind.LIST -> (e as? JsonArray)?.firstOrNull()?.let { diff(path, d.getElementDescriptor(0), it, out, "$where[0]") }
            else -> {}
        }
    }

    private fun <T> check(path: String, s: KSerializer<T>): List<String> {
        val out = mutableListOf<String>()
        diff(path, s.descriptor, raw(path), out)
        return out
    }

    @Test fun a_readEndpointsMatchModels() {
        live(); login()
        val c = runBlocking { repo.customers(null, null, "recent", 1) }
        assertTrue("seeded customers", c.items.isNotEmpty())
        val cid = c.items.first().id
        val camp = runBlocking { repo.campaigns() }.items.firstOrNull()?.id
        val conv = runBlocking { repo.inbox(null, false, null) }.conversations.firstOrNull()?.customer?.id
        val kn = runBlocking { repo.knowledge(null, null) }.items.firstOrNull()?.id
        val all = mutableListOf<String>()
        all += check("api/v1/me", Me.serializer())
        all += check("api/v1/status", ShopStatus.serializer())
        all += check("api/v1/dashboard", Dashboard.serializer())
        all += check("api/v1/insights", Insights.serializer())
        all += check("api/v1/customers?sort=recent", CustomerPage.serializer())
        all += check("api/v1/customers/$cid", CustomerDetail.serializer())
        all += check("api/v1/campaigns/audience", Audience.serializer())
        all += check("api/v1/campaigns", CampaignList.serializer())
        if (camp != null) all += check("api/v1/campaigns/$camp", CampaignDetail.serializer())
        all += check("api/v1/posts", PostList.serializer())
        all += check("api/v1/knowledge", KnowledgeList.serializer())
        if (kn != null) all += check("api/v1/knowledge/$kn", Knowledge.serializer())
        all += check("api/v1/inbox", InboxPage.serializer())
        if (conv != null) all += check("api/v1/inbox/$conv", Thread.serializer())
        all += check("api/v1/settings", Settings.serializer())
        all += check("api/v1/settings/facebook", FacebookState.serializer())
        all += check("api/v1/billing", Billing.serializer())
        all += check("api/v1/tickets", TicketList.serializer())
        report.parentFile.mkdirs()
        report.writeText(all.joinToString("\n"))
        println(all.joinToString("\n"))
    }

    private inline fun expectApiError(what: String, block: () -> Unit): ApiException {
        try { block() } catch (e: ApiException) { println("$what -> ${e.status} ${e.code}: ${e.message}"); assertTrue("$what message", e.message.isNotBlank()); return e }
        fail("$what should fail with ApiException"); throw IllegalStateException()
    }

    @Test fun b_customerLifecycle() = runBlocking {
        live(); login()
        val phone = "01711" + (100000..999999).random()
        val id = repo.addCustomer(NewCustomer("Test Kotlin", phone, items = "Saree", amount = 2500, area = "Dhanmondi")).id
        assertTrue(id.isNotBlank())
        assertEquals("same phone updates the customer", id, repo.addCustomer(NewCustomer("Test Kotlin", phone)).id)
        expectApiError("bad phone") { repo.addCustomer(NewCustomer("Bad", "123")) }
        var d = repo.customer(id)
        assertEquals("Test Kotlin", d.name); assertEquals(1, d.orders.size); assertEquals(2500L, d.total)
        repo.updateCustomer(id, CustomerPatch(name = "Test Renamed", note = "likes red", email = "t@example.com"))
        repo.addOrder(id, NewOrder(1200, "Kurti"))
        repo.logCall(id, "phone", "asked about delivery"); repo.logCall(id, "whatsapp")
        d = repo.customer(id)
        assertEquals("Test Renamed", d.name); assertEquals("likes red", d.note); assertEquals(2, d.orders.size); assertEquals(3700L, d.total)
        val search = repo.customers("Renamed", null, "recent", 1)
        assertTrue(search.items.any { it.id == id })
        for (seg in listOf("vip", "regular", "new", "inactive")) repo.customers(null, seg, "total", 1)
        for (sort in listOf("recent", "total", "name")) repo.customers(null, null, sort, 1)
        repo.updateCustomer(id, CustomerPatch(optedOut = true))
        assertTrue(repo.customer(id).optedOut)
        repo.deleteCustomer(id)
        expectApiError("deleted customer") { repo.customer(id) }
        Unit
    }

    @Test fun c_importCsv() = runBlocking {
        live(); login()
        val f = File.createTempFile("cust", ".csv")
        val p1 = "01811" + (100000..999999).random(); val p2 = "01911" + (100000..999999).random()
        f.writeText("Name,Mobile,Total Spent,Orders\nRahim,$p1,5000,3\nKarim,$p2,800,1\nBad,12,0,0\n")
        val uri = android.net.Uri.fromFile(f)
        val pre = repo.importPreview(uri, "c.csv", "text/csv")
        println("preview: $pre")
        assertEquals(3, pre.rows); assertEquals("Mobile", pre.mapping.phone); assertEquals(1, pre.invalid)
        val res = repo.importCustomers(uri, "c.csv", "text/csv")
        println("import: $res")
        assertEquals(2, res.created + res.updated)
    }

    @Test fun d_campaignAndAi() = runBlocking {
        live(); login()
        val a = repo.audience()
        assertTrue(a.counts.all > 0)
        val msg = repo.aiMessage("vip", "10% off", "text")
        println("ai message: $msg"); assertTrue(msg.text.isNotBlank())
        val id = repo.createCampaign(NewCampaign(name = "Kotlin test", segment = "vip", message = msg.text, channels = listOf("wa"), `when` = "now")).id
        val d = repo.campaign(id)
        println("campaign: ${d.status} ${d.summary} msgs=${d.messages.size}")
        assertTrue(repo.campaigns().items.any { it.id == id })
        val at = java.time.Instant.now().plusSeconds(86400).toString()
        val id2 = repo.createCampaign(NewCampaign(segment = "inactive", message = "Hi {name}", channels = listOf("sms"), `when` = "later", sendAt = at)).id
        assertEquals("scheduled", repo.campaign(id2).status)
    }

    @Test fun e_postsKnowledge() = runBlocking {
        live(); login()
        val t = repo.aiPost("New Eid collection", "friendly"); println("ai post: $t"); assertTrue(t.text.isNotBlank())
        val at = java.time.Instant.now().plusSeconds(7200).toString()
        val pid = repo.schedulePost(NewPost(t.text, at, "New Eid collection")).id
        assertTrue(repo.posts().items.any { it.id == pid })
        repo.cancelPost(pid)
        println("after cancel: " + repo.posts().items.firstOrNull { it.id == pid })
        val kid = repo.addKnowledge(KnowledgeBody("product", "Jamdani saree", "Handwoven", 4500)).id
        assertEquals(4500L, repo.knowledgeItem(kid).price)
        repo.updateKnowledge(kid, KnowledgeBody("product", "Jamdani saree (red)", "Handwoven", 4800))
        repo.setKnowledgeActive(kid, false)
        val k = repo.knowledgeItem(kid); assertEquals("Jamdani saree (red)", k.title); assertFalse(k.active)
        assertTrue(repo.knowledge("Jamdani", "product").items.any { it.id == kid })
        for (type in listOf("policy", "faq", "note")) repo.deleteKnowledge(repo.addKnowledge(KnowledgeBody(type, "T $type", "body")).id)
        repo.deleteKnowledge(kid)
        repo.setBrandVoice("Warm, short, Bangla first")
        assertEquals("Warm, short, Bangla first", repo.knowledge(null, null).brandVoice)
    }

    @Test fun f_inbox() = runBlocking {
        live(); login()
        val page = repo.inbox(null, false, null)
        println("inbox: ${page.conversations.size} unread=${page.unreadTotal}")
        repo.inbox(null, true, null)
        val cid = page.conversations.firstOrNull()?.customer?.id ?: repo.customers(null, null, "recent", 1).items.first().id
        val th = repo.thread(cid)
        println("thread window=${th.windowOpen} msgs=${th.messages.size}")
        val r = runCatching { repo.sendMessage(cid, "Kotlin test hello") }
        println("send: $r")
        repo.markRead(cid)
        println("suggest: " + runCatching { repo.suggestReply(cid) })
        if (th.nextCursor != null) repo.thread(cid, th.nextCursor)
    }

    @Test fun g_settingsBillingSupport() = runBlocking {
        live(); login()
        val s = repo.settings()
        repo.patchSettings(repo.fields("name" to s.profile.name, "country" to "BD", "currency" to "BDT", "timezone" to "Asia/Dhaka", "language" to "bn"))
        repo.updateMe(MePatch(uiLang = "en"))
        println("fb: " + repo.facebook())
        expectApiError("woo connect to bad url") { repo.connectStore(StoreBody("woocommerce", "https://example.invalid", "ck_x", "cs_x")) }
        val b = repo.billing(); println("billing: ${b.plans.map { it.key + " " + it.price }} online=${b.onlinePayments}")
        println("checkout: " + runCatching { repo.checkout(b.plans.last().key, 1) })
        val tid = repo.openTicket("Kotlin test", "Cannot find export button")
        assertTrue(repo.tickets().items.any { it.id == tid.id })
        val ins = repo.insights(); ins.notifications.firstOrNull()?.let { repo.dismiss(it.key) }
        repo.refresh()
        expectApiError("wrong password") { repo.login("demo@dakly.app", "nope") }
        println("forgot: " + repo.forgot("demo@dakly.app"))
    }

    @Test fun h_registerAndDelete() = runBlocking {
        live()
        val email = "kt${System.currentTimeMillis()}@example.com"
        repo.register(RegisterBody("Test Owner", "Test Shop", email, "secret123", country = "IN", language = "en"))
        val me = repo.me.value!!
        println("registered: ${me.shop}")
        assertEquals("IN", me.shop.country); assertEquals("INR", me.shop.currency)
        assertEquals("pending" == me.shop.status || "active" == me.shop.status, true)
        expectApiError("delete with wrong password") { repo.deleteAccount("bad") }
        repo.deleteAccount("secret123")
        assertFalse(repo.isLoggedIn())
        expectApiError("login after delete") { repo.login(email, "secret123") }
        Unit
    }

    @Test fun i_logout() = runBlocking {
        live(); login()
        repo.logout()
        assertFalse(repo.isLoggedIn())
        expectApiError("me after logout") { repo.loadMe() }
        Unit
    }

    @Test fun j_releaseAdditions() = runBlocking {
        live(); login()
        val ob = repo.loadMe().onboarding
        println("onboarding: $ob")
        assertNotNull(ob); assertTrue(ob!!.steps.isNotEmpty()); assertTrue(ob.steps.all { it.label.isNotBlank() && it.href.startsWith("/") })
        val f = repo.exportCustomers(File.createTempFile("xyz", "").parentFile!!.resolve("export-test"))
        val text = f.readText()
        println("export: ${f.name} ${f.length()} bytes, first line: ${text.lineSequence().first()}")
        assertTrue(text.startsWith("\uFEFFname,phone")); assertTrue(text.lines().size > 5)
        val b = repo.billing(); println("payments: ${b.payments}")

        // change password: wrong current fails, right one returns a new token and signs out the old one
        val email = registerFresh("secret123")
        val oldToken = app.session.current()!!
        expectApiError("change with wrong current") { repo.changePassword("wrong", "newsecret1") }
        repo.changePassword("secret123", "newsecret1")
        assertNotEquals(oldToken, app.session.current())
        repo.loadMe()
        val r = OkHttpClient().newCall(Request.Builder().url("$base/api/v1/me").header("Authorization", "Bearer $oldToken").build()).execute()
        assertEquals("old token revoked", 401, r.code); r.close()

        // reset from the emailed link
        repo.logout()
        expectApiError("bad reset token") { repo.resetPassword("not-a-real-token-123", "another123") }
        repo.resetPassword(makeResetToken(email), "another123")
        assertTrue(repo.isLoggedIn()); assertEquals(email, repo.me.value?.user?.email)
        repo.logout(); repo.login(email, "another123")
        repo.deleteAccount("another123")
    }
}
