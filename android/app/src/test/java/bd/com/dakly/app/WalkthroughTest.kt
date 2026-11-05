package bd.com.dakly.app

import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Drives the real app (MainActivity, real network, real screens) against a running Dakly backend
 * and saves a screenshot after every step. No emulator needed: it runs on the JVM with Robolectric.
 *
 *   node backend/test/walkthrough-seed.mjs en        -> prints {"email","password"}
 *   ./gradlew :app:testDebugUnitTest --tests '*WalkthroughTest*' \
 *       -PdaklyApi=http://localhost:3000 -Pwalkthrough -PdaklyEmail=... -PdaklyPassword=...
 *
 * Skipped in normal unit-test runs (no -Pwalkthrough).
 */
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34])
abstract class Walkthrough {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()

    protected val email = System.getProperty("dakly.email").orEmpty()
    protected val password = System.getProperty("dakly.password").orEmpty()
    private lateinit var dir: File
    private var step = 0

    @Before fun only() {
        assumeTrue("walkthrough disabled", System.getProperty("dakly.walkthrough") == "true" && email.isNotBlank())
    }

    // ---------- helpers ----------
    protected fun shot(name: String) {
        rule.waitForIdle()
        Thread.sleep(250)
        rule.waitForIdle()
        step++
        rule.onRoot().captureRoboImage(File(dir, "%02d-%s.png".format(step, name)).path)
    }

    protected fun has(text: String) =
        rule.onAllNodesWithText(text, substring = true, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()

    protected fun waitFor(text: String, ms: Long = 30_000) = rule.waitUntil(ms) { has(text) }

    protected fun node(text: String, last: Boolean = false): SemanticsNodeInteraction {
        waitFor(text)
        val all = rule.onAllNodesWithText(text, substring = false, useUnmergedTree = true)
        val n = all.fetchSemanticsNodes().size
        return all[if (last) n - 1 else 0]
    }

    protected fun tap(text: String, last: Boolean = false) {
        val n = node(text, last)
        runCatching { n.performScrollTo() }
        n.performClick()
        rule.waitForIdle()
    }

    protected fun tapIcon(description: String) {
        rule.waitUntil(30_000) { rule.onAllNodes(hasContentDescription(description), true).fetchSemanticsNodes().isNotEmpty() }
        rule.onAllNodes(hasContentDescription(description), true)[0].performClick()
        rule.waitForIdle()
    }

    protected fun type(label: String, value: String) {
        rule.waitUntil(30_000) { rule.onAllNodes(hasSetTextAction() and hasText(label, substring = true)).fetchSemanticsNodes().isNotEmpty() }
        val f = rule.onAllNodes(hasSetTextAction() and hasText(label, substring = true))[0]
        runCatching { f.performScrollTo() }
        f.performTextClearance()
        f.performTextInput(value)
    }

    protected fun back() {
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.onBackPressed() }
        rule.waitForIdle()
    }

    protected fun scrollDown() {
        rule.onRoot().performTouchInput { swipeUp(startY = bottom * 0.8f, endY = top + bottom * 0.2f) }
        rule.waitForIdle()
    }

    protected fun tab(label: String) = tap(label, last = true)

    protected fun logIn() {
        waitFor("Log in to Dakly")
        type("Email", email)
        type("Password", password)
        tap("Log in")
        waitFor("Rahima Fashion", 45_000) // the Home header (always on screen, unlike lazy-list sections)
    }

    protected fun start(name: String) {
        dir = File(System.getProperty("dakly.walkthrough.dir"), name).apply { deleteRecursively(); mkdirs() }
    }

}

/** Phone, light theme: the full journey, one screenshot per step. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "en-rUS-w411dp-h891dp-xxhdpi")
class PhoneWalkthroughTest : Walkthrough() {
    @Test
    fun phone() {
        start("android-phone")
        waitFor("Log in to Dakly")
        shot("login")

        tap("No account? Create one")
        type("Your name", "Rahima Akter")
        type("Shop or Facebook Page name", "Rahima Fashion")
        type("Email", "new-seller@example.com")
        type("Password", "a-strong-password")
        shot("register-form")
        tap("Already have an account? Log in")

        type("Email", email)
        type("Password", password)
        shot("login-filled")
        tap("Log in")
        waitFor("Rahima Fashion", 45_000) // the Home header (always on screen, unlike lazy-list sections)
        shot("home")
        scrollDown()
        shot("home-scrolled")

        tab("Customers")
        waitFor("Ayesha Begum")
        shot("customers")
        tap("VIP")
        Thread.sleep(1500)
        shot("customers-vip")
        tap("Ayesha Begum")
        waitFor("Orders")
        shot("customer-detail")
        back()

        tab("Inbox")
        waitFor("Ayesha Begum")
        shot("inbox")
        tap("Ayesha Begum")
        waitFor("Eid collection")
        shot("chat")
        tapIcon("AI reply suggestion")
        Thread.sleep(4000)
        shot("chat-ai-suggestion")
        back()

        tab("Campaigns")
        Thread.sleep(1500)
        shot("campaigns")
        tap("New campaign", last = true)
        waitFor("Who should get it?")
        shot("wizard-1-audience")
        tap("Inactive")
        tap("Next")
        waitFor("How should it reach them?")
        shot("wizard-2-channel")
        tap("Next")
        waitFor("Offer or news")
        type("Offer or news", "15% off the new Eid collection this week")
        tap("Write with AI")
        Thread.sleep(5000)
        shot("wizard-3-ai-message")
        tap("Next")
        waitFor("Review and send")
        shot("wizard-4-review")
        tap("Send", last = true)
        waitFor("Karim Uddin", 30_000) // the campaign screen has loaded its recipients (the inactive customers)
        rule.mainClock.advanceTimeBy(1_000)
        shot("campaign-sent")
        back()

        tab("More")
        waitFor("AI Facebook posts")
        shot("more")
        tap("AI Facebook posts")
        waitFor("What do you want to promote?")
        type("What do you want to promote?", "New Eid three-piece collection, 2450 taka")
        tap("Write post with AI")
        Thread.sleep(5000)
        shot("posts-ai")
        back()
        tap("AI knowledge base")
        waitFor("Delivery")
        shot("knowledge")
        back()
        tap("Settings")
        Thread.sleep(2500)
        shot("settings")
        back()
        tap("Plan and billing")
        Thread.sleep(2500)
        shot("billing")
        back()
        tap("Notifications")
        Thread.sleep(2500)
        shot("notifications")
        back()
        tap("Help and support")
        Thread.sleep(2000)
        shot("support")
    }

}

/** Phone, dark theme. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "en-rUS-w411dp-h891dp-night-xxhdpi")
class PhoneDarkWalkthroughTest : Walkthrough() {
    @Test
    fun phoneDark() {
        start("android-phone-dark")
        logIn()
        shot("home-dark")
        tab("Customers"); waitFor("Ayesha Begum"); shot("customers-dark")
        tab("Inbox"); waitFor("Ayesha Begum"); shot("inbox-dark")
    }

}

/** Tablet, landscape: side rail and capped content width. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "en-rUS-w1280dp-h800dp-land-xhdpi")
class TabletWalkthroughTest : Walkthrough() {
    @Test
    fun tablet() {
        start("android-tablet")
        logIn()
        shot("home-tablet")
        tab("Customers"); waitFor("Ayesha Begum"); shot("customers-tablet")
        tab("Inbox"); waitFor("Ayesha Begum"); shot("inbox-tablet")
    }
}
