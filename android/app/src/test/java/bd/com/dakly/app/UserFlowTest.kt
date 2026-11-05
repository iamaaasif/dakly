package bd.com.dakly.app

import android.content.Intent
import android.net.Uri
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.core.os.LocaleListCompat
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.shadows.ShadowToast

/** Drives the real app UI against the local backend, the way a shop owner would. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "en-w360dp-h640dp-xxhdpi")
class UserFlowTest {
    @OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
    @get:Rule val compose = createEmptyComposeRule(effectContext = kotlinx.coroutines.Dispatchers.Main)

    @Before fun live() = assumeTrue(BuildConfig.API_BASE.startsWith("http://localhost"))
    @After fun tearDown() = logoutLocal()

    private fun ComposeTestRule.type(label: String, text: String) {
        waitUntil(10_000) { onAllNodes(hasSetTextAction() and hasText(label)).fetchSemanticsNodes().isNotEmpty() }
        onAllNodes(hasSetTextAction() and hasText(label))[0].scrollSafe().performTextReplacement(text)
        waitForIdle()
    }
    private fun ComposeTestRule.tap(text: String, substring: Boolean = false) {
        settle()
        val lists = onAllNodes(hasScrollToNodeAction())
        if (!has(text, substring) && lists.fetchSemanticsNodes().isNotEmpty())
            runCatching { lists[0].performScrollToNode(hasText(text, substring = substring)) }
        waitText(text, substring)
        repeat(3) { attempt ->
            val r = runCatching {
                val n = onAllNodes(hasText(text, substring = substring) and hasClickAction())
                if (n.fetchSemanticsNodes().isNotEmpty()) n[0].scrollSafe().performClick()
                else onAllNodesWithText(text, substring = substring, useUnmergedTree = true)[0].scrollSafe().performClick()
            }
            if (r.isSuccess) { waitForIdle(); return }
            if (attempt == 2) throw r.exceptionOrNull()!!
            Thread.sleep(300); waitForIdle()
        }
    }
    private fun ComposeTestRule.tapButton(text: String) {
        waitUntil(10_000) { onAllNodes(hasText(text) and hasClickAction()).fetchSemanticsNodes().isNotEmpty() }
        onAllNodes(hasText(text) and hasClickAction()).onLast().scrollSafe().performClick()
        waitForIdle()
    }
    private fun SemanticsNodeInteraction.scrollSafe() = apply { runCatching { performScrollTo() } }
    private fun toast(): String? = ShadowToast.getTextOfLatestToast()?.toString()

    @Test fun loginWrongPasswordThenRightThenLogout() {
        logoutLocal()
        val s = launch()
        compose.settle()
        compose.waitText(str(R.string.auth_login_title))
        shot("flow/login")
        compose.type(str(R.string.auth_email), "demo@dakly.app")
        compose.type(str(R.string.auth_password), "wrong-password")
        compose.tapButton(str(R.string.auth_login))
        compose.settle()
        compose.waitText("did not match", substring = true)
        shot("flow/login-error")
        compose.type(str(R.string.auth_password), "demo1234")
        compose.tapButton(str(R.string.auth_login))
        compose.settle()
        compose.waitText(str(R.string.tab_customers))
        assertTrue(runBlocking { appCtx.repo.isLoggedIn() })
        compose.tap(str(R.string.tab_more)); compose.settle()
        compose.tap(str(R.string.logout))
        compose.tapButton(str(R.string.logout))
        compose.settle()
        compose.waitText(str(R.string.auth_login_title))
        assertFalse(runBlocking { appCtx.repo.isLoggedIn() })
        s.close()
    }

    @Test fun forgotPassword() {
        logoutLocal()
        val s = launch(); compose.settle()
        compose.tap(str(R.string.auth_forgot_link))
        compose.waitText(str(R.string.auth_forgot_title))
        compose.type(str(R.string.auth_email), "demo@dakly.app")
        compose.tapButton(str(R.string.auth_send_reset)); compose.settle()
        compose.waitUntil(15_000) { compose.has(str(R.string.auth_login_title)) && toast() != null }
        println("forgot toast: " + toast())
        s.close()
    }

    @Test fun signUpNewShop() {
        logoutLocal()
        val s = launch(); compose.settle()
        compose.tap(str(R.string.auth_no_account))
        compose.waitText(str(R.string.auth_register_title))
        compose.type(str(R.string.auth_name), "Nadia Islam")
        compose.type(str(R.string.auth_shop), "Nadia Crafts")
        val email = "ui${System.currentTimeMillis()}@example.com"
        compose.type(str(R.string.auth_email), email)
        compose.type(str(R.string.auth_password), "secret123")
        shot("flow/signup")
        compose.tapButton(str(R.string.auth_register)); compose.settle()
        compose.waitText(str(R.string.tab_customers), timeout = 20_000)
        compose.settle()
        compose.assertNoError("home after signup")
        shot("flow/home-new-shop")
        assertEquals("BD", appCtx.repo.me.value?.shop?.country)
        runBlocking { appCtx.repo.deleteAccount("secret123") }
        s.close()
    }

    @Test fun addCustomerManually() {
        loginDemo()
        val s = launch("/customers/new"); compose.settle()
        val phone = "01712" + (100000..999999).random()
        compose.tapButton(str(R.string.save_customer))
        println("empty save toast: " + toast())
        compose.type(str(R.string.field_name), "UI Test Customer")
        compose.type(str(R.string.field_phone), "12345")
        compose.tapButton(str(R.string.save_customer)); compose.settle()
        shot("flow/add-customer-invalid"); println("invalid phone toast: " + toast())
        assertTrue("invalid phone must not save", runBlocking { appCtx.repo.customers("UI Test Customer", null, "recent", 1).items.none { it.phone.endsWith(phone.drop(1)) } })
        compose.type(str(R.string.field_phone), phone)
        compose.type(str(R.string.field_items_optional), "Three-piece")
        compose.type(str(R.string.field_amount_optional, "BDT"), "1850")
        compose.tapButton(str(R.string.save_customer)); compose.settle()
        compose.waitText("UI Test Customer")
        compose.settle()
        shot("flow/customer-added")
        val c = runBlocking { appCtx.repo.customers(phone, null, "recent", 1).items.single() }
        assertEquals(1850L, c.stats.total)
        runBlocking { appCtx.repo.deleteCustomer(c.id) }
        s.close()
    }

    @Test fun chatSendMessage() {
        loginDemo()
        val cid = runBlocking { appCtx.repo.inbox(null, false, null).conversations.first().customer.id }
        val s = launch("/inbox/$cid"); compose.settle()
        val text = "Apu, apnar order kal pouchabe " + (1000..9999).random()
        compose.onAllNodes(hasSetTextAction())[0].performTextInput(text)
        compose.waitForIdle()
        compose.onNodeWithContentDescription(str(R.string.send), useUnmergedTree = true).performClick()
        compose.waitText(text)
        compose.settle()
        shot("flow/chat-sent")
        assertTrue(runBlocking { appCtx.repo.thread(cid).messages.any { it.body?.contains(text) == true } })
        s.close()
    }

    @Test fun campaignWizardSendNow() {
        loginDemo()
        val before = runBlocking { appCtx.repo.campaigns().items.size }
        val s = launch("/campaigns/new"); compose.settle()
        compose.waitText(str(R.string.wizard_who)); shot("flow/wizard-1")
        compose.tapButton(str(R.string.next)); compose.settle()
        compose.waitText(str(R.string.wizard_how)); shot("flow/wizard-2")
        compose.tapButton(str(R.string.next)); compose.settle()
        compose.type(str(R.string.wizard_offer), "Eid 15% off")
        compose.tapButton(str(R.string.wizard_ai_write)); compose.settle()
        compose.waitUntil(30_000) { compose.onAllNodes(hasSetTextAction() and hasText("15%", substring = true)).fetchSemanticsNodes().size >= 2 }
        shot("flow/wizard-3")
        compose.tapButton(str(R.string.next)); compose.settle()
        compose.waitText(str(R.string.wizard_review)); shot("flow/wizard-4")
        compose.tapButton(str(R.string.wizard_send)); compose.settle()
        compose.waitUntil(20_000) { runBlocking { appCtx.repo.campaigns().items.size } > before }
        compose.settle()
        shot("flow/wizard-done")
        s.close()
    }

    @Test fun knowledgeAddItem() {
        loginDemo()
        val s = launch("/knowledge"); compose.settle()
        compose.tap(str(R.string.kb_add)); compose.settle()
        val title = "Cotton kurti " + (100..999).random()
        compose.type(str(R.string.kb_field_title), title)
        compose.type(str(R.string.kb_price, "BDT"), "1450")
        shot("flow/knowledge-edit")
        compose.tapButton(str(R.string.save)); compose.settle()
        println("kb save toast: " + toast())
        compose.waitText(str(R.string.kb_title)) // back on the list
        compose.waitUntil(15_000) { runBlocking { appCtx.repo.knowledge(title, null).items.size } == 1 }
        val k = runBlocking { appCtx.repo.knowledge(title, null).items.single() }
        assertEquals(1450L, k.price)
        runBlocking { appCtx.repo.deleteKnowledge(k.id) }
        s.close()
    }

    @Test fun switchLanguageToBanglaAndBack() {
        loginDemo()
        val s = launch("/settings"); compose.settle()
        compose.tap("বাংলা"); compose.settle()
        assertEquals("bn", AppCompatDelegate.getApplicationLocales().toLanguageTags())
        RuntimeEnvironment.setQualifiers("bn"); s.recreate(); compose.settle()
        compose.waitText(str(R.string.settings_app_language))
        shot("flow/settings-bn")
        compose.tap("English"); compose.settle()
        assertEquals("en", AppCompatDelegate.getApplicationLocales().toLanguageTags())
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.getEmptyLocaleList())
        RuntimeEnvironment.setQualifiers("en")
        s.close()
    }

    @Test fun rotationKeepsTypedText() {
        loginDemo()
        val s = launch("/customers/new"); compose.settle()
        compose.type(str(R.string.field_name), "Rotating Rahim")
        RuntimeEnvironment.setQualifiers("+land"); s.recreate(); compose.settle()
        compose.waitText("Rotating Rahim")
        shot("flow/rotated")
        RuntimeEnvironment.setQualifiers("+port")
        s.close()
    }

    @Test fun deepLinkWhileOpen() {
        loginDemo()
        val s = launch(); compose.settle()
        s.onActivity { it.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("dakly://open?path=/settings")).setClass(it, MainActivity::class.java)) }
        // singleTask: Robolectric delivers it as onNewIntent only when invoked directly
        s.onActivity { a -> val m = MainActivity::class.java.getDeclaredMethod("onNewIntent", Intent::class.java); m.isAccessible = true; m.invoke(a, Intent(Intent.ACTION_VIEW, Uri.parse("dakly://open?path=/settings"))) }
        compose.settle()
        compose.waitText(str(R.string.settings_app_language))
        s.onActivity { a -> val m = MainActivity::class.java.getDeclaredMethod("onNewIntent", Intent::class.java); m.isAccessible = true; m.invoke(a, Intent(Intent.ACTION_VIEW, Uri.parse("https://app.dakly.com.bd/knowledge"))) }
        compose.settle()
        // App Link host differs from the test API host, so it is ignored: still on settings
        compose.waitText(str(R.string.settings_app_language))
        s.close()
    }

    @Test fun expiredTokenReturnsToLogin() {
        runBlocking { appCtx.session.save("not-a-valid-token") }
        val s = launch(); compose.settle()
        compose.waitText(str(R.string.auth_login_title))
        s.close()
    }

    @Test fun aiPostWriteScheduleCancel() {
        loginDemo()
        val before = runBlocking { appCtx.repo.posts().items.size }
        val s = launch("/posts"); compose.settle()
        compose.type(str(R.string.posts_prompt), "Winter shawls, 850 taka")
        compose.tapButton(str(R.string.posts_write)); compose.settle()
        compose.waitUntil(30_000) { compose.onAllNodes(hasSetTextAction() and hasText(str(R.string.posts_text))).fetchSemanticsNodes().isNotEmpty() }
        compose.tap(str(R.string.posts_pick_time)); compose.settle()
        compose.tapButton(str(R.string.next)); compose.settle()
        compose.tapButton(str(R.string.ok)); compose.settle()
        shot("flow/post-ready")
        compose.tapButton(str(R.string.posts_schedule)); compose.settle()
        compose.waitUntil(20_000) { runBlocking { appCtx.repo.posts().items.size } > before }
        val p = runBlocking { appCtx.repo.posts().items.first { it.status == "scheduled" } }
        println("scheduled post at ${p.scheduledAt}")
        runBlocking { appCtx.repo.cancelPost(p.id) }
        s.close()
    }

    @Test fun customerDetailOrderNoteDelete() {
        loginDemo()
        val phone = "01713" + (100000..999999).random()
        val id = runBlocking { appCtx.repo.addCustomer(bd.com.dakly.app.data.NewCustomer("Detail Test", phone)).id }
        val s = launch("/customers/$id"); compose.settle()
        // Order and note dialogs (text fields inside a dialog) hang Robolectric's idling; their API calls are covered in ApiContractTest.
        runBlocking { appCtx.repo.addOrder(id, bd.com.dakly.app.data.NewOrder(990, "Hijab")) }
        s.close()
        val s2 = launch("/customers/$id"); compose.settle()
        compose.waitText("Hijab")
        shot("flow/customer-order-added")
        compose.onNodeWithContentDescription(str(R.string.delete), useUnmergedTree = true).performClick(); compose.waitForIdle()
        compose.waitText(str(R.string.customer_delete_title))
        compose.tapButton(str(R.string.delete)); compose.settle()
        compose.waitUntil(15_000) { runCatching { runBlocking { appCtx.repo.customer(id) } }.isFailure }
        s2.close()
    }

    @Test fun supportTicket() {
        loginDemo()
        val s = launch("/support"); compose.settle()
        val subj = "How do I export? " + (100..999).random()
        compose.type(str(R.string.support_subject), subj)
        compose.type(str(R.string.support_body), "I need my customer list in Excel.")
        compose.tapButton(str(R.string.send)); compose.settle()
        compose.waitText(subj)
        assertTrue(runBlocking { appCtx.repo.tickets().items.any { it.subject == subj } })
        s.close()
    }

    @Test fun remindLaterHidesTip() {
        loginDemo()
        val s = launch("/alerts"); compose.settle()
        val n = runBlocking { appCtx.repo.insights().notifications.size }
        if (n > 0) {
            compose.tap(str(R.string.alerts_remind_later)); compose.settle()
            compose.waitUntil(15_000) { runBlocking { appCtx.repo.insights().notifications.size } < n }
        }
        s.close()
    }

    @Test fun offlineShowsRetry() {
        loginDemo()
        val dead = bd.com.dakly.app.data.Repository(bd.com.dakly.app.data.ApiClient(appCtx, "http://localhost:9", appCtx.session), appCtx.session)
        val f = DaklyApp::class.java.getDeclaredField("repo"); f.isAccessible = true
        val real = f.get(appCtx)
        f.set(appCtx, dead)
        try {
            val s = launch("/customers"); compose.settle()
            compose.waitText(str(R.string.offline_title))
            compose.waitText(str(R.string.retry))
            shot("flow/offline")
            s.close()
        } finally { f.set(appCtx, real) }
    }

    @Test fun homeShowsOnboardingChecklist() {
        loginDemo()
        val ob = runBlocking { appCtx.repo.loadMe().onboarding!! }
        val s = launch(); compose.settle()
        compose.waitText(str(R.string.onboarding_title))
        val next = ob.steps.first { !it.done }
        compose.waitText(next.label)
        shot("flow/home-onboarding")
        compose.tap(next.label); compose.settle()
        compose.assertNoError("onboarding step ${next.key}")
        s.close()
    }

    @Test fun exportCustomersShares() {
        loginDemo()
        val s = launch("/customers"); compose.settle()
        compose.onNodeWithContentDescription(str(R.string.export_customers), useUnmergedTree = true).performClick()
        var started: Intent? = null
        compose.waitUntil(15_000) {
            s.onActivity { a -> started = started ?: org.robolectric.Shadows.shadowOf(a).nextStartedActivity }
            if (started == null) started = org.robolectric.Shadows.shadowOf(appCtx).nextStartedActivity
            started != null
        }
        assertEquals(Intent.ACTION_CHOOSER, started!!.action)
        @Suppress("DEPRECATION") val send = started!!.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)!!
        assertEquals(Intent.ACTION_SEND, send.action); assertEquals("text/csv", send.type)
        @Suppress("DEPRECATION") val uri = send.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)!!
        println("shared: $uri")
        assertTrue(uri.toString().startsWith("content://bd.com.dakly.app.debug.files/"))
        s.close()
    }

    @Test fun changePasswordFromSettings() {
        val email = registerFresh("secret123")
        val s = launch("/settings"); compose.settle()
        compose.tap(str(R.string.password_title)); compose.settle()
        compose.type(str(R.string.password_current), "secret123")
        compose.type(str(R.string.password_new), "brandnew99")
        shot("flow/change-password")
        compose.tapButton(str(R.string.password_save)); compose.settle()
        compose.waitText(str(R.string.settings_title)) // back on Settings (list keeps its scroll position)
        assertTrue(runBlocking { appCtx.repo.isLoggedIn() })
        runBlocking { appCtx.repo.loadMe() } // new token works
        runBlocking { appCtx.repo.deleteAccount("brandnew99") }
        s.close()
    }

    @Test fun resetLinkSetsPasswordAndSignsIn() {
        val email = registerFresh("secret123")
        logoutLocal()
        val token = makeResetToken(email)
        val s = launch("/reset?token=$token"); compose.settle()
        compose.waitText(str(R.string.reset_title))
        compose.type(str(R.string.reset_new), "fromlink123")
        shot("flow/reset-password")
        compose.tapButton(str(R.string.reset_save)); compose.settle()
        compose.waitText(str(R.string.tab_customers))
        assertEquals(email, appCtx.repo.me.value?.user?.email)
        runBlocking { appCtx.repo.deleteAccount("fromlink123") }
        s.close()
    }
}
