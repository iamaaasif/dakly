package bd.com.dakly.app

import android.content.Intent
import android.net.Uri
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import com.github.takahirom.roborazzi.captureScreenRoboImage
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue

val appCtx: DaklyApp get() = ApplicationProvider.getApplicationContext()
fun str(id: Int, vararg a: Any): String = appCtx.getString(id, *a)

private var demoToken: String? = null
/** Logs in once per test run and reuses the token, so the backend's login limiter never trips. */
fun loginDemo() = runBlocking {
    val t = demoToken
    if (t != null && runCatching { appCtx.session.save(t); appCtx.repo.loadMe() }.isSuccess) return@runBlocking
    else { appCtx.repo.login("demo@dakly.app", "demo1234"); demoToken = appCtx.session.current() }
}
fun logoutLocal() = runBlocking { appCtx.session.clear() }

fun launch(path: String? = null): ActivityScenario<MainActivity> {
    val i = Intent(appCtx, MainActivity::class.java)
    if (path != null) { i.action = Intent.ACTION_VIEW; i.data = Uri.parse("dakly://open?path=" + Uri.encode(path)) }
    return ActivityScenario.launch(i)
}

private val busy = SemanticsMatcher("indeterminate progress") {
    it.config.getOrNull(SemanticsProperties.ProgressBarRangeInfo) == ProgressBarRangeInfo.Indeterminate
}

/** Waits until network-backed loading spinners are gone (real HTTP runs on OkHttp threads). */
fun ComposeTestRule.settle(timeout: Long = 20_000) {
    Thread.sleep(150)
    waitUntil(timeout) { onAllNodes(busy, useUnmergedTree = true).fetchSemanticsNodes().isEmpty() }
    Thread.sleep(150)
    waitForIdle()
}

fun ComposeTestRule.has(text: String, substring: Boolean = false) =
    onAllNodesWithText(text, substring = substring, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()

fun ComposeTestRule.waitText(text: String, substring: Boolean = false, timeout: Long = 20_000) =
    waitUntil(timeout) { has(text, substring) }

fun ComposeTestRule.assertNoError(where: String) {
    assertTrue("$where shows an error screen", !has(str(R.string.error_title)) && !has(str(R.string.offline_title)))
}

fun shot(name: String) = captureScreenRoboImage("build/outputs/roborazzi/$name.png")

fun ComposeTestRule.onNodeWithTextClick(text: String, substring: Boolean = false) {
    waitText(text, substring)
    onAllNodesWithText(text, substring = substring, useUnmergedTree = false)[0].performClick()
    waitForIdle()
}

/** Test-only: creates a password-reset token for [email] straight in the local Postgres (the real one is emailed). */
fun makeResetToken(email: String): String {
    val token = java.util.UUID.randomUUID().toString().replace("-", "") + "x"
    val hash = java.security.MessageDigest.getInstance("SHA-256").digest(token.toByteArray()).joinToString("") { "%02x".format(it) }
    val sql = """insert into "PasswordReset"(id,"userId","tokenHash","expiresAt") select 'pr'||md5(random()::text), id, '$hash', now()+interval '1 hour' from "User" where email='$email'"""
    val p = ProcessBuilder("psql", "-h", "localhost", "-U", "dakly", "dakly", "-v", "ON_ERROR_STOP=1", "-c", sql)
        .apply { environment()["PGPASSWORD"] = "dakly" }.redirectErrorStream(true).start()
    val out = p.inputStream.bufferedReader().readText()
    check(p.waitFor() == 0 && "INSERT 0 1" in out) { out }
    return token
}

fun registerFresh(password: String = "secret123"): String = runBlocking {
    val email = "t${System.nanoTime()}@example.com"
    appCtx.repo.register(bd.com.dakly.app.data.RegisterBody("Fresh Owner", "Fresh Shop", email, password, "BD", "en"))
    email
}
