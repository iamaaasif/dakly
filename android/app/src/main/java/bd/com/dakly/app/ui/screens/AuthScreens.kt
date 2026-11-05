package bd.com.dakly.app.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.HourglassTop
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import bd.com.dakly.app.R
import bd.com.dakly.app.data.RegisterBody
import bd.com.dakly.app.ui.LocalRepo
import bd.com.dakly.app.ui.components.DCard
import bd.com.dakly.app.ui.components.Field
import bd.com.dakly.app.ui.components.PrimaryButton
import bd.com.dakly.app.ui.components.SecondaryButton
import bd.com.dakly.app.ui.errorMessage
import bd.com.dakly.app.ui.theme.Dakly
import bd.com.dakly.app.ui.toast
import bd.com.dakly.app.util.Web
import kotlinx.coroutines.launch
import java.util.Locale

private enum class AuthMode { Login, Register, Forgot }

/** Supported countries for sign-up; the server has the full list in /settings options. */
private val signupCountries = listOf(
    "BD", "IN", "PK", "NP", "LK", "MY", "SG", "ID", "AE", "SA", "QA", "KW", "OM", "BH", "GB", "US", "CA", "AU",
)

@Composable
fun AuthScreen(onSignedIn: () -> Unit) {
    val repo = LocalRepo.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var mode by rememberSaveable { mutableStateOf(AuthMode.Login) }
    var name by rememberSaveable { mutableStateOf("") }
    var shop by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var country by rememberSaveable { mutableStateOf(defaultCountry()) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun submit() {
        error = null
        busy = true
        scope.launch {
            try {
                when (mode) {
                    AuthMode.Login -> {
                        repo.login(email, password)
                        onSignedIn()
                    }
                    AuthMode.Register -> {
                        val lang = if (Locale.getDefault().language == "bn" || country == "BD") "bn" else "en"
                        repo.register(RegisterBody(name.trim(), shop.trim(), email.trim(), password, country, lang))
                        onSignedIn()
                    }
                    AuthMode.Forgot -> {
                        val r = repo.forgot(email)
                        context.toast(r.message ?: context.getString(R.string.auth_reset_sent))
                        mode = AuthMode.Login
                    }
                }
            } catch (e: Exception) {
                error = context.errorMessage(e)
            } finally {
                busy = false
            }
        }
    }

    Box(
        Modifier.fillMaxSize().background(Dakly.colors.paper).systemBarsPadding().imePadding(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier.widthIn(max = 460.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp),
        ) {
            DCard(padding = 22.dp) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Image(
                        painterResource(R.drawable.logo), null,
                        Modifier.size(56.dp).clip(RoundedCornerShape(14.dp)),
                    )
                    Text(
                        stringResource(
                            when (mode) {
                                AuthMode.Login -> R.string.auth_login_title
                                AuthMode.Register -> R.string.auth_register_title
                                AuthMode.Forgot -> R.string.auth_forgot_title
                            },
                        ),
                        style = MaterialTheme.typography.headlineMedium,
                    )
                    Text(stringResource(R.string.tagline), color = Dakly.colors.ink2)
                    Spacer(Modifier.height(4.dp))

                    if (mode == AuthMode.Register) {
                        Field(name, { name = it }, stringResource(R.string.auth_name))
                        Field(shop, { shop = it }, stringResource(R.string.auth_shop))
                        CountryPicker(country) { country = it }
                    }
                    Field(
                        email, { email = it }, stringResource(R.string.auth_email),
                        keyboard = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                    )
                    if (mode != AuthMode.Forgot) {
                        Field(
                            password, { password = it }, stringResource(R.string.auth_password), password = true,
                            keyboard = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                            supporting = if (mode == AuthMode.Register) stringResource(R.string.auth_password_hint) else null,
                        )
                    }
                    if (error != null) Text(error!!, color = Dakly.colors.dak)

                    val canSubmit = when (mode) {
                        AuthMode.Login -> email.isNotBlank() && password.isNotBlank()
                        AuthMode.Register -> name.trim().length >= 2 && shop.trim().length >= 2 && email.contains('@') && password.length >= 8
                        AuthMode.Forgot -> email.contains('@')
                    }
                    PrimaryButton(
                        stringResource(
                            when (mode) {
                                AuthMode.Login -> R.string.auth_login
                                AuthMode.Register -> R.string.auth_register
                                AuthMode.Forgot -> R.string.auth_send_reset
                            },
                        ),
                        Modifier.fillMaxWidth(), enabled = canSubmit, loading = busy, onClick = ::submit,
                    )

                    when (mode) {
                        AuthMode.Login -> {
                            TextButton(onClick = { mode = AuthMode.Forgot; error = null }, Modifier.align(Alignment.CenterHorizontally)) {
                                Text(stringResource(R.string.auth_forgot_link), color = Dakly.colors.ink2)
                            }
                            SecondaryButton(stringResource(R.string.auth_no_account), Modifier.fillMaxWidth()) {
                                mode = AuthMode.Register; error = null
                            }
                        }
                        else -> TextButton(onClick = { mode = AuthMode.Login; error = null }, Modifier.align(Alignment.CenterHorizontally)) {
                            Text(stringResource(R.string.auth_have_account), color = Dakly.colors.dak, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    TextButton(
                        onClick = { Web.open(context, repo.baseUrl + "/privacy") },
                        modifier = Modifier.align(Alignment.CenterHorizontally),
                    ) { Text(stringResource(R.string.privacy_policy), color = Dakly.colors.ink3) }
                }
            }
        }
    }
}

private fun defaultCountry(): String {
    val c = Locale.getDefault().country.uppercase(Locale.ROOT)
    return if (c in signupCountries) c else "BD"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CountryPicker(value: String, onChange: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    val label = { code: String -> Locale("", code).getDisplayCountry(Locale.getDefault()).ifBlank { code } }
    ExposedDropdownMenuBox(expanded = open, onExpandedChange = { open = it }) {
        OutlinedTextField(
            value = label(value), onValueChange = {}, readOnly = true,
            label = { Text(stringResource(R.string.auth_country)) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(open) },
            modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable),
            shape = MaterialTheme.shapes.medium,
        )
        androidx.compose.material3.ExposedDropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            signupCountries.forEach { c ->
                DropdownMenuItem(text = { Text(label(c)) }, onClick = { onChange(c); open = false })
            }
        }
    }
}

/** Shown when the shop is waiting for approval or suspended. */
@Composable
fun ShopStatusScreen(status: String, reason: String?, onRetry: () -> Unit, onLogout: () -> Unit) {
    Column(
        Modifier.fillMaxSize().background(Dakly.colors.paper).systemBarsPadding().padding(28.dp),
        verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        val pending = status == "pending"
        Icon(if (pending) Icons.Outlined.HourglassTop else Icons.Outlined.Block, null, Modifier.size(56.dp), tint = if (pending) Dakly.colors.haldi else Dakly.colors.dak)
        Spacer(Modifier.height(16.dp))
        Text(
            stringResource(if (pending) R.string.status_pending_title else R.string.status_suspended_title),
            style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            reason ?: stringResource(if (pending) R.string.status_pending_body else R.string.status_suspended_body),
            color = Dakly.colors.ink2, textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))
        PrimaryButton(stringResource(R.string.status_check_again), Modifier.fillMaxWidth(), onClick = onRetry)
        Spacer(Modifier.height(8.dp))
        TextButton(onClick = onLogout) { Text(stringResource(R.string.logout), color = Dakly.colors.ink2) }
    }
}
