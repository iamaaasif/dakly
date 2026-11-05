package bd.com.dakly.app.ui.screens

import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material.icons.outlined.PrivacyTip
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material.icons.outlined.Celebration
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.os.LocaleListCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.NavHostController
import bd.com.dakly.app.BuildConfig
import bd.com.dakly.app.R
import bd.com.dakly.app.data.Notice
import bd.com.dakly.app.data.Settings
import bd.com.dakly.app.data.StoreBody
import bd.com.dakly.app.data.Tip
import bd.com.dakly.app.ui.LocalRepo
import bd.com.dakly.app.ui.Routes
import bd.com.dakly.app.ui.components.Avatar
import bd.com.dakly.app.ui.components.Banner
import bd.com.dakly.app.ui.components.ChoiceChips
import bd.com.dakly.app.ui.components.ConfirmDialog
import bd.com.dakly.app.ui.components.ContentPadding
import bd.com.dakly.app.ui.components.DCard
import bd.com.dakly.app.ui.components.EmptyState
import bd.com.dakly.app.ui.components.Field
import bd.com.dakly.app.ui.components.LoadContent
import bd.com.dakly.app.ui.components.Load
import bd.com.dakly.app.ui.components.Pill
import bd.com.dakly.app.ui.components.PrimaryButton
import bd.com.dakly.app.ui.components.ScreenFrame
import bd.com.dakly.app.ui.components.SecondaryButton
import bd.com.dakly.app.ui.components.SectionTitle
import bd.com.dakly.app.ui.components.UsageBar
import bd.com.dakly.app.ui.rememberLoad
import bd.com.dakly.app.ui.theme.Dakly
import bd.com.dakly.app.ui.toast
import bd.com.dakly.app.ui.toastError
import bd.com.dakly.app.util.Format
import bd.com.dakly.app.util.Web
import kotlinx.coroutines.launch

// ============================================================ notifications (smart insights)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlertsScreen(nav: NavHostController) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var refreshTips by remember { mutableStateOf(false) }
    val data = rememberLoad(refreshTips) { repo.insights(refreshTips) }

    ScreenFrame(
        stringResource(R.string.alerts_title), subtitle = stringResource(R.string.alerts_subtitle), onBack = { nav.popBackStack() },
        actions = { IconButton(onClick = { refreshTips = !refreshTips }) { Icon(Icons.Outlined.Refresh, stringResource(R.string.alerts_new_tips)) } },
    ) { inner ->
        Box(Modifier.padding(inner)) {
            LoadContent(data.value, data::reload) { ins ->
                PullToRefreshBox((data.value as? Load.Ready)?.refreshing == true, onRefresh = data::reload) {
                    LazyColumn(contentPadding = ContentPadding, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        val tips = ins.aiTips?.tips.orEmpty()
                        if (tips.isNotEmpty()) {
                            item { SectionTitle(stringResource(R.string.alerts_ai_tips)) }
                            items(tips.size) { i -> TipCard(tips[i]) { nav.navigate(Routes.newCampaign(tips[i].segment, tips[i].offer)) } }
                        }
                        item { SectionTitle(stringResource(R.string.alerts_title)) }
                        if (ins.notifications.isEmpty()) item {
                            EmptyState(Icons.Outlined.NotificationsNone, stringResource(R.string.alerts_empty_title), stringResource(R.string.alerts_empty_body))
                        }
                        items(ins.notifications, key = { it.key }) { n ->
                            NoticeCard(
                                n,
                                onAction = { n.action?.href?.let { nav.navigate(Routes.fromWebPath(it)) } },
                                onDismiss = {
                                    scope.launch {
                                        try { repo.dismiss(n.key); data.set(ins.copy(notifications = ins.notifications - n)) } catch (e: Exception) { ctx.toastError(e) }
                                    }
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TipCard(t: Tip, onAct: () -> Unit) {
    DCard(onClick = onAct) {
        Row {
            IconBubble(Icons.Outlined.AutoAwesome, Dakly.colors.haldi, Dakly.colors.haldiSoft)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(t.title, fontWeight = FontWeight.SemiBold)
                Text(t.body, color = Dakly.colors.ink2, fontSize = 13.5.sp)
                t.why?.takeIf { it.isNotBlank() }?.let { Text(it, color = Dakly.colors.ink3, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp)) }
                Text(stringResource(R.string.home_create_campaign), color = Dakly.colors.accent, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 6.dp))
            }
        }
    }
}

@Composable
private fun NoticeCard(n: Notice, onAction: () -> Unit, onDismiss: () -> Unit) {
    val (fg, bg) = when (n.tone) {
        "warn", "warning", "danger" -> Dakly.colors.bad to Dakly.colors.badSoft
        "good", "success" -> Dakly.colors.leaf to Dakly.colors.leafSoft
        "tip" -> Dakly.colors.haldi to Dakly.colors.haldiSoft
        else -> Dakly.colors.sky to Dakly.colors.skySoft
    }
    val icon: ImageVector = when (n.icon) {
        "clock", "time" -> Icons.Outlined.Notifications
        "trend", "trending" -> Icons.Outlined.TrendingUp
        "alert", "warn" -> Icons.Outlined.Warning
        "party", "star" -> Icons.Outlined.Celebration
        "post", "edit" -> Icons.Outlined.Edit
        else -> Icons.Outlined.Info
    }
    DCard {
        Row {
            IconBubble(icon, fg, bg)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(n.title, fontWeight = FontWeight.SemiBold)
                Text(n.body, color = Dakly.colors.ink2, fontSize = 13.5.sp)
                Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    n.action?.let { a ->
                        androidx.compose.material3.Button(
                            onClick = onAction,
                            shape = androidx.compose.foundation.shape.CircleShape,
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Dakly.colors.dak, contentColor = Dakly.colors.dakInk),
                        ) { Text(a.label, fontSize = 13.sp) }
                    }
                    TextButton(onClick = onDismiss) { Text(stringResource(R.string.alerts_remind_later), color = Dakly.colors.ink2, fontSize = 13.sp) }
                }
            }
        }
    }
}

// ============================================================ "More" tab

@Composable
fun MoreScreen(nav: NavHostController, onLoggedOut: () -> Unit) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val me by repo.me.collectAsState()
    var confirmLogout by remember { mutableStateOf(false) }

    ScreenFrame(stringResource(R.string.tab_more)) { inner ->
        LazyColumn(Modifier.padding(inner), contentPadding = ContentPadding, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                DCard(onClick = { nav.navigate(Routes.SETTINGS) }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Avatar(me?.shop?.name, 48.dp, Dakly.colors.dak, Dakly.colors.dakInk)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(me?.shop?.name.orEmpty(), style = MaterialTheme.typography.titleMedium)
                            Text(me?.user?.email.orEmpty(), color = Dakly.colors.ink3, fontSize = 13.sp)
                        }
                        me?.plan?.name?.takeIf { it.isNotBlank() }?.let { Pill(it, Dakly.colors.leaf, Dakly.colors.leafSoft) }
                    }
                }
            }
            item { MenuRow(Icons.Outlined.Edit, stringResource(R.string.posts_title), stringResource(R.string.posts_subtitle)) { nav.navigate(Routes.POSTS) } }
            item { MenuRow(Icons.Outlined.MenuBook, stringResource(R.string.kb_title), stringResource(R.string.kb_subtitle)) { nav.navigate(Routes.KNOWLEDGE) } }
            item { MenuRow(Icons.Outlined.Notifications, stringResource(R.string.alerts_title), stringResource(R.string.alerts_subtitle)) { nav.navigate(Routes.ALERTS) } }
            item { MenuRow(Icons.Outlined.Settings, stringResource(R.string.settings_title), stringResource(R.string.settings_subtitle)) { nav.navigate(Routes.SETTINGS) } }
            item { MenuRow(Icons.Outlined.CreditCard, stringResource(R.string.billing_title), stringResource(R.string.billing_subtitle)) { nav.navigate(Routes.BILLING) } }
            item { MenuRow(Icons.AutoMirrored.Outlined.HelpOutline, stringResource(R.string.support_title), stringResource(R.string.support_subtitle)) { nav.navigate(Routes.SUPPORT) } }
            item { MenuRow(Icons.Outlined.PrivacyTip, stringResource(R.string.privacy_policy), null) { Web.open(ctx, repo.baseUrl + "/privacy") } }
            item { MenuRow(Icons.AutoMirrored.Outlined.Logout, stringResource(R.string.logout), null) { confirmLogout = true } }
            item {
                Text(
                    stringResource(R.string.version, BuildConfig.VERSION_NAME), color = Dakly.colors.ink3, fontSize = 12.sp,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
        }
    }
    if (confirmLogout) {
        ConfirmDialog(stringResource(R.string.logout), stringResource(R.string.logout_body), stringResource(R.string.logout),
            onConfirm = { scope.launch { repo.logout(); onLoggedOut() } }, onDismiss = { confirmLogout = false })
    }
}

@Composable
private fun MenuRow(icon: ImageVector, title: String, subtitle: String?, onClick: () -> Unit) {
    DCard(onClick = onClick, padding = 12.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconBubble(icon, Dakly.colors.ink2, Dakly.colors.sunk)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.SemiBold)
                if (subtitle != null) Text(subtitle, color = Dakly.colors.ink3, fontSize = 12.5.sp)
            }
        }
    }
}

// ============================================================ settings

@Composable
fun SettingsScreen(nav: NavHostController, onLoggedOut: () -> Unit) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val data = rememberLoad { repo.settings() }
    val fb = rememberLoad { repo.facebook() }
    val me by repo.me.collectAsState()

    // Coming back from the Facebook login tab: reload the Page state.
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(lifecycle) {
        var first = true
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            if (!first) fb.reload()
            first = false
        }
    }

    ScreenFrame(stringResource(R.string.settings_title), onBack = { nav.popBackStack() }) { inner ->
        Box(Modifier.padding(inner).imePadding()) {
            LoadContent(data.value, data::reload) { s ->
                LazyColumn(contentPadding = ContentPadding, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    item { AppLanguageCard() }
                    item { ProfileCard(s) { data.reload() } }
                    me?.plan?.let { p ->
                        item {
                            DCard(onClick = { nav.navigate(Routes.BILLING) }) {
                                Column {
                                    Row {
                                        Text(stringResource(R.string.home_messages_month), Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                                        Text("${Format.number(ctx, p.messages.used)} / ${Format.number(ctx, p.messages.limit)}", color = Dakly.colors.ink2)
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    UsageBar(p.messages.used, p.messages.limit)
                                    Spacer(Modifier.height(10.dp))
                                    Row {
                                        Text(stringResource(R.string.settings_ai_usage), Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                                        Text("${Format.number(ctx, p.ai.used)} / ${Format.number(ctx, p.ai.limit)}", color = Dakly.colors.ink2)
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    UsageBar(p.ai.used, p.ai.limit)
                                }
                            }
                        }
                    }
                    item { FacebookCard(fb.data(), onChanged = { fb.reload() }) }
                    item { StoreCard(s) { data.reload() } }
                    item { ChannelsCard(s) { data.reload() } }
                    item { DeleteAccountCard(onDeleted = onLoggedOut) }
                }
            }
        }
    }
}

/** App language: English or Bangla, independent of the phone language (per-app language). */
@Composable
private fun AppLanguageCard() {
    val repo = LocalRepo.current
    val scope = rememberCoroutineScope()
    val current = AppCompatDelegate.getApplicationLocales().toLanguageTags().substringBefore(',').substringBefore('-').ifBlank { null }
    DCard {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Language, null, tint = Dakly.colors.ink2)
                Spacer(Modifier.width(8.dp))
                Text(stringResource(R.string.settings_app_language), fontWeight = FontWeight.SemiBold)
            }
            ChoiceChips(
                listOf<String?>(null, "en", "bn"), current,
                label = { when (it) { "en" -> "English"; "bn" -> "বাংলা"; else -> stringResource(R.string.settings_phone_language) } },
                onSelect = { tag ->
                    // Tell the server too, so notifications and server texts match.
                    scope.launch { runCatching { repo.updateMe(bd.com.dakly.app.data.MePatch(uiLang = tag)) } }
                    AppCompatDelegate.setApplicationLocales(if (tag == null) LocaleListCompat.getEmptyLocaleList() else LocaleListCompat.forLanguageTags(tag))
                },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProfileCard(s: Settings, onSaved: () -> Unit) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var name by rememberSaveable(s.profile.name) { mutableStateOf(s.profile.name) }
    var country by rememberSaveable(s.profile.country) { mutableStateOf(s.profile.country) }
    var currency by rememberSaveable(s.profile.currency) { mutableStateOf(s.profile.currency) }
    var timezone by rememberSaveable(s.profile.timezone) { mutableStateOf(s.profile.timezone) }
    var language by rememberSaveable(s.profile.language) { mutableStateOf(s.profile.language) }
    var saving by remember { mutableStateOf(false) }

    DCard {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(stringResource(R.string.settings_shop), style = MaterialTheme.typography.titleMedium)
            Field(name, { name = it }, stringResource(R.string.auth_shop))
            Dropdown(stringResource(R.string.auth_country), country, s.options.countries.map { it.code to it.name }) { c ->
                country = c
                s.options.countries.firstOrNull { it.code == c }?.let { currency = it.currency; timezone = it.tz }
            }
            Dropdown(stringResource(R.string.settings_currency), currency, s.options.currencies.map { it to it }) { currency = it }
            Field(timezone, { timezone = it }, stringResource(R.string.settings_timezone), supporting = stringResource(R.string.settings_timezone_hint))
            Dropdown(stringResource(R.string.settings_ai_language), language, s.options.languages.map { it.code to it.name }) { language = it }
            Text(stringResource(R.string.settings_ai_language_hint), color = Dakly.colors.ink3, fontSize = 12.5.sp)
            PrimaryButton(stringResource(R.string.save), Modifier.fillMaxWidth(), loading = saving, enabled = name.trim().length >= 2) {
                saving = true
                scope.launch {
                    try {
                        repo.patchSettings(repo.fields("name" to name.trim(), "country" to country, "currency" to currency, "timezone" to timezone.trim(), "language" to language))
                        ctx.toast(ctx.getString(R.string.saved))
                        onSaved()
                    } catch (e: Exception) { ctx.toastError(e) } finally { saving = false }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Dropdown(label: String, value: String, options: List<Pair<String, String>>, onSelect: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = open, onExpandedChange = { open = it }) {
        OutlinedTextField(
            value = options.firstOrNull { it.first == value }?.second ?: value, onValueChange = {}, readOnly = true,
            label = { Text(label) }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(open) },
            modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable), shape = MaterialTheme.shapes.medium,
        )
        ExposedDropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            options.forEach { (k, l) -> DropdownMenuItem(text = { Text(l) }, onClick = { onSelect(k); open = false }) }
        }
    }
}

@Composable
private fun FacebookCard(state: bd.com.dakly.app.data.FacebookState?, onChanged: () -> Unit) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var confirm by remember { mutableStateOf(false) }
    DCard {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.settings_facebook), style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                Pill(
                    stringResource(if (state?.connected == true) R.string.connected else R.string.not_connected),
                    if (state?.connected == true) Dakly.colors.leaf else Dakly.colors.ink2,
                    if (state?.connected == true) Dakly.colors.leafSoft else Dakly.colors.sunk,
                )
            }
            when {
                state == null -> Text("…", color = Dakly.colors.ink3)
                !state.available -> Text(stringResource(R.string.settings_fb_unavailable), color = Dakly.colors.ink3, fontSize = 13.sp)
                state.connected -> {
                    Text(stringResource(R.string.settings_fb_page, state.page?.name.orEmpty()), color = Dakly.colors.ink2)
                    if (state.pages.size > 1) {
                        Text(stringResource(R.string.settings_fb_choose), fontSize = 13.sp, color = Dakly.colors.ink3)
                        ChoiceChips(state.pages.map { it.id }, state.page?.id, label = { id -> state.pages.first { it.id == id }.name }, onSelect = { id ->
                            scope.launch { try { repo.choosePage(id); onChanged() } catch (e: Exception) { ctx.toastError(e) } }
                        })
                    }
                    TextButton(onClick = { confirm = true }) { Text(stringResource(R.string.disconnect), color = Dakly.colors.bad) }
                }
                else -> {
                    Text(stringResource(R.string.settings_fb_body), color = Dakly.colors.ink2, fontSize = 13.sp)
                    PrimaryButton(stringResource(R.string.settings_fb_connect), Modifier.fillMaxWidth()) {
                        // connectUrl is single-use and short-lived: fetch a fresh one on each tap.
                        scope.launch {
                            try {
                                val url = repo.facebook().connectUrl
                                if (url.isNullOrBlank()) ctx.toast(ctx.getString(R.string.settings_fb_unavailable)) else Web.open(ctx, url, 0xFF1877F2.toInt())
                            } catch (e: Exception) { ctx.toastError(e) }
                        }
                    }
                }
            }
        }
    }
    if (confirm) ConfirmDialog(stringResource(R.string.disconnect), stringResource(R.string.settings_fb_disconnect_body), stringResource(R.string.disconnect), destructive = true,
        onConfirm = { scope.launch { try { repo.disconnectFacebook(); onChanged() } catch (e: Exception) { ctx.toastError(e) } } }, onDismiss = { confirm = false })
}

@Composable
private fun StoreCard(s: Settings, onChanged: () -> Unit) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var type by rememberSaveable { mutableStateOf("woocommerce") }
    var url by rememberSaveable { mutableStateOf("") }
    var key by rememberSaveable { mutableStateOf("") }
    var secret by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    DCard {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.settings_store), style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                Pill(
                    stringResource(if (s.store.type != null) R.string.connected else R.string.not_connected),
                    if (s.store.type != null) Dakly.colors.leaf else Dakly.colors.ink2, if (s.store.type != null) Dakly.colors.leafSoft else Dakly.colors.sunk,
                )
            }
            if (s.store.type != null) {
                Text((if (s.store.type == "shopify") "Shopify" else "WooCommerce") + " · " + s.store.url.orEmpty(), color = Dakly.colors.ink2)
                s.store.syncedAt?.let { Text(stringResource(R.string.settings_store_synced, Format.relative(it)), color = Dakly.colors.ink3, fontSize = 12.5.sp) }
                s.store.error?.let { Text(it, color = Dakly.colors.bad, fontSize = 12.5.sp) }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SecondaryButton(stringResource(R.string.settings_sync_now), Modifier.weight(1f), enabled = !busy) {
                        busy = true
                        scope.launch { try { ctx.toast(repo.syncStore().message ?: ctx.getString(R.string.done)); onChanged() } catch (e: Exception) { ctx.toastError(e) } finally { busy = false } }
                    }
                    TextButton(onClick = { scope.launch { try { repo.disconnectStore(); onChanged() } catch (e: Exception) { ctx.toastError(e) } } }) {
                        Text(stringResource(R.string.disconnect), color = Dakly.colors.bad)
                    }
                }
            } else {
                Text(stringResource(R.string.settings_store_body), color = Dakly.colors.ink2, fontSize = 13.sp)
                ChoiceChips(listOf("woocommerce", "shopify"), type, label = { if (it == "shopify") "Shopify" else "WooCommerce" }, onSelect = { type = it })
                Field(url, { url = it }, stringResource(R.string.settings_store_url), hint = "https://", keyboard = KeyboardOptions(keyboardType = KeyboardType.Uri))
                Field(key, { key = it }, stringResource(if (type == "shopify") R.string.settings_store_token else R.string.settings_store_key), password = true)
                if (type == "woocommerce") Field(secret, { secret = it }, stringResource(R.string.settings_store_secret), password = true)
                PrimaryButton(stringResource(R.string.connect), Modifier.fillMaxWidth(), loading = busy, enabled = url.startsWith("http") && key.isNotBlank()) {
                    busy = true
                    scope.launch {
                        try {
                            val r = repo.connectStore(StoreBody(type, url.trim(), key.trim(), secret.trim().ifBlank { null }))
                            ctx.toast(r.message ?: ctx.getString(R.string.done))
                            key = ""; secret = ""
                            onChanged()
                        } catch (e: Exception) { ctx.toastError(e) } finally { busy = false }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChannelsCard(s: Settings, onChanged: () -> Unit) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var open by rememberSaveable { mutableStateOf(false) }
    val v = s.channels.values
    val fields = remember(s) {
        mutableMapOf(
            "waPhoneNumberId" to v["waPhoneNumberId"].orEmpty(), "waAccessToken" to "",
            "waTemplateName" to v["waTemplateName"].orEmpty(), "waTemplateLang" to v["waTemplateLang"].orEmpty(),
            "smsApiUrl" to v["smsApiUrl"].orEmpty(), "smsApiKey" to "", "smsSenderId" to v["smsSenderId"].orEmpty(),
            "twilioSid" to v["twilioSid"].orEmpty(), "twilioToken" to "", "twilioFrom" to v["twilioFrom"].orEmpty(),
        )
    }
    var tick by remember { mutableStateOf(0) }
    var busy by remember { mutableStateOf(false) }

    DCard {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(stringResource(R.string.settings_channels), style = MaterialTheme.typography.titleMedium)
            ChannelLine(stringResource(R.string.ch_whatsapp), s.channels.state.wa)
            ChannelLine(stringResource(R.string.ch_sms), s.channels.state.sms)
            ChannelLine(stringResource(R.string.ch_voice), s.channels.state.voice)
            Text(stringResource(R.string.settings_channels_hint), color = Dakly.colors.ink3, fontSize = 12.5.sp)
            if (!open) {
                SecondaryButton(stringResource(R.string.settings_channels_own), Modifier.fillMaxWidth()) { open = true }
            } else {
                key(tick) {
                    val secret = { k: String -> s.channels.saved[k] == true }
                    listOf(
                        "waPhoneNumberId" to R.string.cf_wa_phone_id, "waAccessToken" to R.string.cf_wa_token,
                        "waTemplateName" to R.string.cf_wa_template, "waTemplateLang" to R.string.cf_wa_template_lang,
                        "smsApiUrl" to R.string.cf_sms_url, "smsApiKey" to R.string.cf_sms_key, "smsSenderId" to R.string.cf_sms_sender,
                        "twilioSid" to R.string.cf_twilio_sid, "twilioToken" to R.string.cf_twilio_token, "twilioFrom" to R.string.cf_twilio_from,
                    ).forEach { (k, label) ->
                        var value by remember { mutableStateOf(fields[k].orEmpty()) }
                        val isSecret = k.endsWith("Token") || k == "smsApiKey"
                        Field(
                            value, { value = it; fields[k] = it }, stringResource(label), password = isSecret,
                            hint = if (isSecret && secret(k)) stringResource(R.string.cf_saved_keep) else null,
                        )
                    }
                }
                PrimaryButton(stringResource(R.string.save), Modifier.fillMaxWidth(), loading = busy) {
                    busy = true
                    scope.launch {
                        try {
                            val pairs = fields.filter { (k, value) -> !((k.endsWith("Token") || k == "smsApiKey") && value.isBlank()) }.map { it.key to it.value.trim() }
                            repo.patchSettings(repo.fields(*pairs.toTypedArray()))
                            ctx.toast(ctx.getString(R.string.saved)); open = false; onChanged()
                        } catch (e: Exception) { ctx.toastError(e) } finally { busy = false }
                    }
                }
                TextButton(onClick = {
                    scope.launch {
                        try { repo.patchSettings(repo.fields("clearChannels" to true)); ctx.toast(ctx.getString(R.string.saved)); open = false; onChanged() } catch (e: Exception) { ctx.toastError(e) }
                    }
                }) { Text(stringResource(R.string.settings_channels_clear), color = Dakly.colors.bad) }
            }
        }
    }
}

@Composable
private fun ChannelLine(name: String, state: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(name, Modifier.weight(1f))
        val (label, fg, bg) = when (state) {
            "own" -> Triple(R.string.ch_state_own, Dakly.colors.leaf, Dakly.colors.leafSoft)
            "platform" -> Triple(R.string.ch_state_platform, Dakly.colors.sky, Dakly.colors.skySoft)
            else -> Triple(R.string.ch_state_off, Dakly.colors.haldi, Dakly.colors.haldiSoft)
        }
        Pill(stringResource(label), fg, bg)
    }
}

@Composable
private fun DeleteAccountCard(onDeleted: () -> Unit) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var open by remember { mutableStateOf(false) }
    var password by remember { mutableStateOf("") }
    var typed by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    DCard {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(stringResource(R.string.delete_account), style = MaterialTheme.typography.titleMedium, color = Dakly.colors.bad)
            Text(stringResource(R.string.delete_account_body), color = Dakly.colors.ink2, fontSize = 13.sp)
            TextButton(onClick = { open = true }) { Text(stringResource(R.string.delete_account), color = Dakly.colors.bad, fontWeight = FontWeight.Bold) }
        }
    }
    if (open) {
        AlertDialog(
            onDismissRequest = { open = false },
            title = { Text(stringResource(R.string.delete_account)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(stringResource(R.string.delete_account_confirm))
                    Field(password, { password = it }, stringResource(R.string.auth_password), password = true)
                    Field(typed, { typed = it }, stringResource(R.string.delete_account_type))
                }
            },
            confirmButton = {
                TextButton(enabled = !busy && password.isNotBlank() && typed.trim() == "DELETE", onClick = {
                    busy = true
                    scope.launch {
                        try { repo.deleteAccount(password); open = false; onDeleted() } catch (e: Exception) { ctx.toastError(e) } finally { busy = false }
                    }
                }) { Text(stringResource(R.string.delete), color = Dakly.colors.bad, fontWeight = FontWeight.Bold) }
            },
            dismissButton = { TextButton(onClick = { open = false }) { Text(stringResource(R.string.cancel)) } },
        )
    }
}

// ============================================================ billing

@Composable
fun BillingScreen(nav: NavHostController) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val data = rememberLoad { repo.billing() }
    var months by rememberSaveable { mutableStateOf(1) }

    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(lifecycle) {
        var first = true
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) { if (!first) { data.reload(); runCatching { repo.loadMe() } }; first = false }
    }

    ScreenFrame(stringResource(R.string.billing_title), onBack = { nav.popBackStack() }) { inner ->
        Box(Modifier.padding(inner)) {
            LoadContent(data.value, data::reload) { b ->
                LazyColumn(contentPadding = ContentPadding, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    item {
                        Text(
                            stringResource(R.string.billing_current, b.plans.firstOrNull { it.key == b.current }?.name ?: b.current.orEmpty()) +
                                (b.until?.let { " · " + stringResource(R.string.billing_until, Format.date(ctx, it)) } ?: ""),
                            color = Dakly.colors.ink2,
                        )
                    }
                    if (!b.onlinePayments) item { Banner(stringResource(R.string.billing_offline), Dakly.colors.haldi, Dakly.colors.haldiSoft) }
                    item {
                        ChoiceChips(listOf(1, 3, 6, 12), months, label = { ctx.resources.getQuantityString(R.plurals.months, it, Format.number(ctx, it)) }, onSelect = { months = it })
                    }
                    items(b.plans, key = { it.key }) { p ->
                        val current = p.key == b.current
                        DCard {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(p.name, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                                    if (current) Pill(stringResource(R.string.billing_current_badge), Dakly.colors.leaf, Dakly.colors.leafSoft)
                                }
                                Text(
                                    if (p.price.amount == 0L) stringResource(R.string.billing_free)
                                    else stringResource(R.string.billing_per_month, Format.money(ctx, p.price.amount.toDouble(), p.price.currency)),
                                    style = MaterialTheme.typography.headlineSmall, color = Dakly.colors.accent,
                                )
                                Text(stringResource(R.string.billing_limits, Format.number(ctx, p.messages), Format.number(ctx, p.ai)), color = Dakly.colors.ink2, fontSize = 13.sp)
                                p.features.forEach { Text("• $it", color = Dakly.colors.ink2, fontSize = 13.sp) }
                                if (p.price.amount > 0 && b.onlinePayments) {
                                    PrimaryButton(
                                        stringResource(R.string.billing_pay, Format.money(ctx, (p.price.amount * months).toDouble(), p.price.currency)),
                                        Modifier.fillMaxWidth(),
                                    ) {
                                        scope.launch {
                                            try { Web.open(ctx, repo.checkout(p.key, months).url) } catch (e: Exception) { ctx.toastError(e) }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ============================================================ support

@Composable
fun SupportScreen(nav: NavHostController) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val data = rememberLoad { repo.tickets() }
    var subject by rememberSaveable { mutableStateOf("") }
    var body by rememberSaveable { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }

    ScreenFrame(stringResource(R.string.support_title), onBack = { nav.popBackStack() }) { inner ->
        LazyColumn(Modifier.padding(inner).imePadding(), contentPadding = ContentPadding, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                DCard {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(stringResource(R.string.support_new), style = MaterialTheme.typography.titleMedium)
                        Field(subject, { subject = it }, stringResource(R.string.support_subject))
                        Field(body, { body = it }, stringResource(R.string.support_body), singleLine = false, minLines = 4)
                        PrimaryButton(stringResource(R.string.send), Modifier.fillMaxWidth(), enabled = subject.trim().length >= 3 && body.trim().length >= 5, loading = sending) {
                            sending = true
                            scope.launch {
                                try { repo.openTicket(subject.trim(), body.trim()); subject = ""; body = ""; ctx.toast(ctx.getString(R.string.support_sent)); data.reload() }
                                catch (e: Exception) { ctx.toastError(e) } finally { sending = false }
                            }
                        }
                    }
                }
            }
            item { SectionTitle(stringResource(R.string.support_tickets)) }
            val list = data.data()?.items.orEmpty()
            if (list.isEmpty()) item { Text(stringResource(R.string.support_none), color = Dakly.colors.ink3) }
            items(list, key = { it.id }) { t ->
                DCard {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(t.subject, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                            Pill(t.status, Dakly.colors.ink2, Dakly.colors.sunk)
                        }
                        t.messages.forEach { m ->
                            HorizontalDivider(color = Dakly.colors.line)
                            Text(
                                stringResource(if (m.fromStaff) R.string.support_from_team else R.string.inbox_you) + " · " + Format.relative(m.createdAt),
                                color = if (m.fromStaff) Dakly.colors.leaf else Dakly.colors.ink3, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                            )
                            Text(m.body, color = Dakly.colors.ink2)
                        }
                    }
                }
            }
        }
    }
}
