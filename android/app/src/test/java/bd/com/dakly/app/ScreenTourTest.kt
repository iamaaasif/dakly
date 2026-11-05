package bd.com.dakly.app

import androidx.compose.ui.test.junit4.createEmptyComposeRule
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Opens every screen (through its deep link) in each language and theme, checks it loads, and saves a screenshot. */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w360dp-h640dp-xxhdpi")
class ScreenTourTest(private val lang: String, private val night: Boolean) {
    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "{0}-night{1}")
        fun params() = listOf(arrayOf<Any>("en", false), arrayOf<Any>("bn", false), arrayOf<Any>("en", true), arrayOf<Any>("bn", true))
    }

    @OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
    @get:Rule val compose = createEmptyComposeRule(effectContext = kotlinx.coroutines.Dispatchers.Main)

    @After fun tearDown() = logoutLocal()

    @Test fun everyScreen() {
        assumeTrue(BuildConfig.API_BASE.startsWith("http://localhost"))
        RuntimeEnvironment.setQualifiers("+$lang" + if (night) "-night" else "-notnight")
        loginDemo()
        val repo = appCtx.repo
        val cid = runBlocking { repo.customers(null, null, "total", 1).items.first().id }
        val chat = runBlocking { repo.inbox(null, false, null).conversations.first().customer.id }
        val camp = runBlocking { repo.campaigns().items.first().id }
        val routes = listOf(
            "home" to "/", "customers" to "/customers", "customer" to "/customers/$cid", "customer-new" to "/customers/new",
            "inbox" to "/inbox", "chat" to "/inbox/$chat", "campaigns" to "/campaigns", "campaign" to "/campaigns/$camp",
            "campaign-new" to "/campaigns/new?segment=inactive&offer=15%25", "posts" to "/posts", "knowledge" to "/knowledge",
            "alerts" to "/alerts", "settings" to "/settings", "billing" to "/billing", "support" to "/support",
        )
        val suffix = "$lang" + if (night) "-dark" else ""
        for ((name, path) in routes) {
            val s = launch(path)
            compose.settle()
            compose.assertNoError(name)
            shot("tour/$suffix/$name")
            s.close()
        }
        val s = launch(); compose.settle(); compose.onNodeWithTextClick(str(R.string.tab_more)); compose.settle(); shot("tour/$suffix/more"); s.close()
    }
}
