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

/** Google Play phone screenshots (1080x1920) of the seeded demo shop, in Bangla and English. Read-only. */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w360dp-h640dp-xxhdpi")
class PlayScreenshotsTest(private val lang: String) {
    companion object {
        @JvmStatic @ParameterizedRobolectricTestRunner.Parameters(name = "{0}")
        fun params() = listOf(arrayOf<Any>("bn"), arrayOf<Any>("en"))
    }
    @OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
    @get:Rule val compose = createEmptyComposeRule(effectContext = kotlinx.coroutines.Dispatchers.Main)
    @After fun tearDown() = logoutLocal()

    @Test fun capture() {
        assumeTrue(System.getProperty("dakly.play") == "1" && BuildConfig.API_BASE.startsWith("http://localhost"))
        RuntimeEnvironment.setQualifiers("+$lang-notnight")
        loginDemo()
        val repo = appCtx.repo
        val vip = runBlocking { repo.customers(null, "vip", "total", 1).items.first().id }
        val chat = runBlocking { repo.inbox(null, false, null).conversations.first().customer.id }
        val shots = listOf(
            "1-home" to "/", "2-customers" to "/customers", "3-customer" to "/customers/$vip",
            "4-chat" to "/inbox/$chat", "5-campaign" to "/campaigns/new?segment=inactive&offer=15%25", "6-knowledge" to "/knowledge",
        )
        for ((name, path) in shots) {
            val s = launch(path); compose.settle(); compose.assertNoError(name)
            shot("play/$lang/$name"); s.close()
        }
    }
}
