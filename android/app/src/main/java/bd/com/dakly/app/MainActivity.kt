package bd.com.dakly.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import bd.com.dakly.app.ui.DaklyRoot
import bd.com.dakly.app.ui.LocalRepo
import bd.com.dakly.app.ui.theme.DaklyTheme

/**
 * Single activity. AppCompatActivity is used so the per-app language (English/Bangla)
 * chosen in Settings applies on every Android version.
 */
class MainActivity : AppCompatActivity() {

    /** App path from an App Link or dakly:// intent, e.g. "/customers/abc". Consumed by the nav host. */
    private val pendingPath = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        pendingPath.value = pathFrom(intent)
        val repo = (application as DaklyApp).repo
        setContent {
            CompositionLocalProvider(LocalRepo provides repo) {
                DaklyTheme {
                    DaklyRoot(pendingPath = pendingPath.value, onPathHandled = { pendingPath.value = null })
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        pathFrom(intent)?.let { pendingPath.value = it }
    }

    private fun pathFrom(intent: Intent?): String? {
        val data: Uri = intent?.data ?: return null
        return when (data.scheme) {
            "dakly" -> data.getQueryParameter("path")?.takeIf { it.startsWith("/") && !it.startsWith("//") } ?: "/"
            "https" -> if (data.host.equals(Uri.parse(BuildConfig.API_BASE).host, ignoreCase = true)) {
                (data.encodedPath ?: "/") + (data.encodedQuery?.let { "?$it" } ?: "")
            } else null
            else -> null
        }
    }
}
