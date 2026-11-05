package bd.com.dakly.app.ui.screens

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.Policy
import androidx.compose.material.icons.outlined.QuestionAnswer
import androidx.compose.material.icons.outlined.RecordVoiceOver
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.StickyNote2
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import bd.com.dakly.app.R
import bd.com.dakly.app.data.Knowledge
import bd.com.dakly.app.data.KnowledgeBody
import bd.com.dakly.app.data.NewPost
import bd.com.dakly.app.ui.LocalRepo
import bd.com.dakly.app.ui.Routes
import bd.com.dakly.app.ui.components.Banner
import bd.com.dakly.app.ui.components.ChoiceChips
import bd.com.dakly.app.ui.components.ConfirmDialog
import bd.com.dakly.app.ui.components.ContentPadding
import bd.com.dakly.app.ui.components.DCard
import bd.com.dakly.app.ui.components.DFab
import bd.com.dakly.app.ui.components.EmptyState
import bd.com.dakly.app.ui.components.Field
import bd.com.dakly.app.ui.components.LoadContent
import bd.com.dakly.app.ui.components.Load
import bd.com.dakly.app.ui.components.Pill
import bd.com.dakly.app.ui.components.PrimaryButton
import bd.com.dakly.app.ui.components.ScreenFrame
import bd.com.dakly.app.ui.components.SecondaryButton
import bd.com.dakly.app.ui.components.SectionTitle
import bd.com.dakly.app.ui.components.statusColors
import bd.com.dakly.app.ui.rememberLoad
import bd.com.dakly.app.ui.statusLabel
import bd.com.dakly.app.ui.theme.Dakly
import bd.com.dakly.app.ui.toast
import bd.com.dakly.app.ui.toastError
import bd.com.dakly.app.util.Format
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneOffset
import java.time.ZonedDateTime

// ============================================================ AI Facebook posts

/** Tone keys are what the API expects; labels are localized. */
private val tones = listOf(
    "বন্ধুসুলভ" to R.string.tone_friendly,
    "Offer-কেন্দ্রিক" to R.string.tone_offer,
    "মজার" to R.string.tone_fun,
    "আবেগী" to R.string.tone_emotional,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostsScreen(nav: NavHostController) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val posts = rememberLoad { repo.posts() }
    val fb = rememberLoad { repo.facebook() }
    var prompt by rememberSaveable { mutableStateOf("") }
    var tone by rememberSaveable { mutableStateOf(tones.first().first) }
    var text by rememberSaveable { mutableStateOf("") }
    var writing by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var at by rememberSaveable { mutableStateOf<String?>(null) }
    var pickDate by remember { mutableStateOf(false) }
    var pickTime by remember { mutableStateOf<LocalDate?>(null) }
    var cancelId by remember { mutableStateOf<String?>(null) }

    ScreenFrame(stringResource(R.string.posts_title), subtitle = stringResource(R.string.posts_subtitle), onBack = { nav.popBackStack() }) { inner ->
        LazyColumn(Modifier.padding(inner).imePadding(), contentPadding = ContentPadding, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            val connected = fb.data()?.connected
            if (connected == false) item {
                Banner(stringResource(R.string.posts_fb_not_connected), action = stringResource(R.string.posts_connect), onAction = { nav.navigate(Routes.SETTINGS) })
            }
            item {
                DCard {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Field(prompt, { prompt = it }, stringResource(R.string.posts_prompt), hint = stringResource(R.string.posts_prompt_hint), singleLine = false, minLines = 2)
                        ChoiceChips(tones.map { it.first }, tone, label = { k -> stringResource(tones.first { it.first == k }.second) }, onSelect = { tone = it })
                        PrimaryButton(stringResource(R.string.posts_write), Modifier.fillMaxWidth(), enabled = prompt.isNotBlank(), loading = writing, icon = Icons.Outlined.AutoAwesome) {
                            writing = true
                            scope.launch { try { text = repo.aiPost(prompt.trim(), tone).text } catch (e: Exception) { ctx.toastError(e) } finally { writing = false } }
                        }
                        if (text.isNotBlank() || writing) {
                            if (writing) LinearProgressIndicator(Modifier.fillMaxWidth(), color = Dakly.colors.dak)
                            Field(text, { text = it }, stringResource(R.string.posts_text), singleLine = false, minLines = 6)
                            SecondaryButton(
                                at?.let { Format.dateTime(ctx, it) } ?: stringResource(R.string.posts_pick_time),
                                Modifier.fillMaxWidth(), icon = Icons.Outlined.Schedule,
                            ) { pickDate = true }
                            PrimaryButton(stringResource(R.string.posts_schedule), Modifier.fillMaxWidth(), enabled = text.isNotBlank() && at != null, loading = saving) {
                                saving = true
                                scope.launch {
                                    try {
                                        repo.schedulePost(NewPost(text.trim(), at!!, prompt.ifBlank { null }))
                                        ctx.toast(ctx.getString(R.string.posts_scheduled_ok))
                                        text = ""; prompt = ""; at = null
                                        posts.reload()
                                    } catch (e: Exception) { ctx.toastError(e) } finally { saving = false }
                                }
                            }
                        }
                    }
                }
            }
            item { SectionTitle(stringResource(R.string.posts_list)) }
            when (val s = posts.value) {
                is Load.Ready -> if (s.data.items.isEmpty()) item { Text(stringResource(R.string.posts_empty), color = Dakly.colors.ink3) }
                else items(s.data.items, key = { it.id }) { p ->
                    DCard {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                val (f, b) = statusColors(p.status)
                                Pill(stringResource(statusLabel(p.status)), f, b)
                                Spacer(Modifier.width(8.dp))
                                Text(Format.dateTime(ctx, p.publishedAt ?: p.scheduledAt), color = Dakly.colors.ink3, fontSize = 12.sp, modifier = Modifier.weight(1f))
                                if (p.status == "scheduled") IconButton(onClick = { cancelId = p.id }) { Icon(Icons.Outlined.Delete, stringResource(R.string.cancel)) }
                            }
                            Text(p.text, maxLines = 5, overflow = TextOverflow.Ellipsis, color = Dakly.colors.ink2)
                            if (!p.error.isNullOrBlank()) Text(p.error, color = Dakly.colors.dak, fontSize = 12.sp)
                        }
                    }
                }
                is Load.Failed -> item { TextButton(onClick = posts::reload) { Text(stringResource(R.string.retry)) } }
                Load.Loading -> item { LinearProgressIndicator(Modifier.fillMaxWidth(), color = Dakly.colors.dak) }
            }
        }
    }

    if (pickDate) {
        val state = rememberDatePickerState(initialSelectedDateMillis = Format.pickerDay(Format.parseInstant(at)))
        DatePickerDialog(
            onDismissRequest = { pickDate = false },
            confirmButton = { TextButton(onClick = { pickDate = false; state.selectedDateMillis?.let { pickTime = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate() } }) { Text(stringResource(R.string.next)) } },
            dismissButton = { TextButton(onClick = { pickDate = false }) { Text(stringResource(R.string.cancel)) } },
        ) { DatePicker(state) }
    }
    pickTime?.let { date ->
        val state = rememberTimePickerState(20, 0)
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { pickTime = null },
            confirmButton = {
                TextButton(onClick = {
                    val t = ZonedDateTime.of(date, LocalTime.of(state.hour, state.minute), Format.shopZone).toInstant()
                    if (t.isBefore(Instant.now().plusSeconds(60))) ctx.toast(ctx.getString(R.string.wizard_future)) else { at = t.toString(); pickTime = null }
                }) { Text(stringResource(R.string.ok)) }
            },
            dismissButton = { TextButton(onClick = { pickTime = null }) { Text(stringResource(R.string.cancel)) } },
            text = { TimePicker(state) },
        )
    }
    cancelId?.let { id ->
        ConfirmDialog(stringResource(R.string.posts_cancel_title), stringResource(R.string.posts_cancel_body), stringResource(R.string.posts_cancel_confirm), destructive = true,
            onConfirm = { scope.launch { try { repo.cancelPost(id); posts.reload() } catch (e: Exception) { ctx.toastError(e) } } },
            onDismiss = { cancelId = null })
    }
}

// ============================================================ AI knowledge base

private val knowledgeTypes = listOf("product", "policy", "faq", "voice", "note")

fun knowledgeTypeLabel(t: String?): Int = when (t) {
    "product" -> R.string.kb_product
    "policy" -> R.string.kb_policy
    "faq" -> R.string.kb_faq
    "voice" -> R.string.kb_voice
    else -> R.string.kb_note
}

fun knowledgeTypeIcon(t: String?): ImageVector = when (t) {
    "product" -> Icons.Outlined.Inventory2
    "policy" -> Icons.Outlined.Policy
    "faq" -> Icons.Outlined.QuestionAnswer
    "voice" -> Icons.Outlined.RecordVoiceOver
    else -> Icons.Outlined.StickyNote2
}

@Composable
fun KnowledgeScreen(nav: NavHostController) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var q by rememberSaveable { mutableStateOf("") }
    var debounced by rememberSaveable { mutableStateOf("") }
    var type by rememberSaveable { mutableStateOf<String?>(null) }
    LaunchedEffect(q) { delay(350); debounced = q.trim() }
    val data = rememberLoad(debounced, type) { repo.knowledge(debounced.ifBlank { null }, type) }
    var voice by rememberSaveable { mutableStateOf<String?>(null) }
    var savingVoice by remember { mutableStateOf(false) }
    val loadedKb = data.data()
    LaunchedEffect(loadedKb) { if (voice == null && loadedKb != null) voice = loadedKb.brandVoice.orEmpty() }

    ScreenFrame(
        stringResource(R.string.kb_title), subtitle = stringResource(R.string.kb_subtitle), onBack = { nav.popBackStack() },
        fab = { DFab(stringResource(R.string.kb_add), Icons.Outlined.Add) { nav.navigate(Routes.knowledgeEdit(type = type)) } },
    ) { inner ->
        Column(Modifier.padding(inner)) {
            OutlinedTextField(
                value = q, onValueChange = { q = it }, singleLine = true,
                leadingIcon = { Icon(Icons.Outlined.Search, null) }, placeholder = { Text(stringResource(R.string.kb_search)) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp), shape = RoundedCornerShape(14.dp),
            )
            Spacer(Modifier.height(10.dp))
            ChoiceChips(listOf<String?>(null) + knowledgeTypes, type, label = { if (it == null) stringResource(R.string.seg_all) else stringResource(knowledgeTypeLabel(it)) },
                onSelect = { type = it }, modifier = Modifier.padding(horizontal = 16.dp))
            LoadContent(data.value, data::reload) { kb ->
                LazyColumn(contentPadding = ContentPadding, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    item { Banner(stringResource(R.string.kb_explain), Dakly.colors.sky, Dakly.colors.skySoft) }
                    if (type == null && debounced.isBlank()) item {
                        DCard {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(stringResource(R.string.kb_brand_voice), fontWeight = FontWeight.SemiBold)
                                Field(voice.orEmpty(), { voice = it }, stringResource(R.string.kb_brand_voice_field), hint = stringResource(R.string.kb_brand_voice_hint), singleLine = false, minLines = 2)
                                SecondaryButton(stringResource(R.string.save), enabled = !savingVoice && voice != kb.brandVoice.orEmpty()) {
                                    savingVoice = true
                                    scope.launch {
                                        try { repo.setBrandVoice(voice.orEmpty().trim()); ctx.toast(ctx.getString(R.string.saved)); data.reload() } catch (e: Exception) { ctx.toastError(e) } finally { savingVoice = false }
                                    }
                                }
                            }
                        }
                    }
                    if (kb.items.isEmpty()) item {
                        EmptyState(Icons.Outlined.MenuBook, stringResource(R.string.kb_empty_title), stringResource(R.string.kb_empty_body),
                            stringResource(R.string.kb_add)) { nav.navigate(Routes.knowledgeEdit(type = type ?: "product")) }
                    }
                    items(kb.items, key = { it.id }) { k ->
                        KnowledgeRow(k, kb.currency, onClick = { nav.navigate(Routes.knowledgeEdit(k.id)) }) { active ->
                            scope.launch { try { repo.setKnowledgeActive(k.id, active); data.reload() } catch (e: Exception) { ctx.toastError(e) } }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun KnowledgeRow(k: Knowledge, currency: String, onClick: () -> Unit, onToggle: (Boolean) -> Unit) {
    val ctx = LocalContext.current
    DCard(onClick = onClick, padding = 12.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconBubble(knowledgeTypeIcon(k.type), Dakly.colors.sky, Dakly.colors.skySoft)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(k.title, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    color = if (k.active) Dakly.colors.ink else Dakly.colors.ink3)
                val sub = listOfNotNull(
                    ctx.getString(knowledgeTypeLabel(k.type)),
                    k.price?.let { Format.money(ctx, it.toDouble(), currency) },
                    k.body?.takeIf { it.isNotBlank() }?.replace('\n', ' '),
                ).joinToString(" · ")
                Text(sub, color = Dakly.colors.ink3, fontSize = 12.5.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            Switch(k.active, onToggle, colors = SwitchDefaults.colors(checkedTrackColor = Dakly.colors.leaf))
        }
    }
}

@Composable
fun KnowledgeEditScreen(nav: NavHostController, id: String?, initialType: String?) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var loaded by rememberSaveable { mutableStateOf(id == null) }
    var type by rememberSaveable { mutableStateOf(initialType ?: "product") }
    var title by rememberSaveable { mutableStateOf("") }
    var body by rememberSaveable { mutableStateOf("") }
    var price by rememberSaveable { mutableStateOf("") }
    var active by rememberSaveable { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }

    LaunchedEffect(id) {
        if (id != null && !loaded) {
            try {
                val k = repo.knowledgeItem(id)
                type = k.type; title = k.title; body = k.body.orEmpty(); price = k.price?.toString().orEmpty(); active = k.active
                loaded = true
            } catch (e: Exception) { ctx.toastError(e); nav.popBackStack() }
        }
    }

    ScreenFrame(
        stringResource(if (id == null) R.string.kb_add else R.string.kb_edit), onBack = { nav.popBackStack() },
        actions = { if (id != null) IconButton(onClick = { confirmDelete = true }) { Icon(Icons.Outlined.Delete, stringResource(R.string.delete)) } },
    ) { inner ->
        if (!loaded) {
            Box(Modifier.padding(inner).fillMaxWidth()) { LinearProgressIndicator(Modifier.fillMaxWidth(), color = Dakly.colors.dak) }
            return@ScreenFrame
        }
        Column(
            Modifier.padding(inner).imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            ChoiceChips(knowledgeTypes, type, label = { stringResource(knowledgeTypeLabel(it)) }, onSelect = { type = it })
            Text(stringResource(knowledgeHint(type)), color = Dakly.colors.ink3, fontSize = 13.sp)
            Field(title, { title = it }, stringResource(if (type == "faq") R.string.kb_question else R.string.kb_field_title))
            Field(body, { body = it }, stringResource(if (type == "faq") R.string.kb_answer else R.string.kb_field_body), singleLine = false, minLines = 5)
            if (type == "product") {
                Field(price, { price = it.filter(Char::isDigit) }, stringResource(R.string.kb_price, Format.shopCurrency),
                    keyboard = KeyboardOptions(keyboardType = KeyboardType.Number))
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(stringResource(R.string.kb_active), fontWeight = FontWeight.SemiBold)
                    Text(stringResource(R.string.kb_active_hint), color = Dakly.colors.ink3, fontSize = 12.5.sp)
                }
                Switch(active, { active = it }, colors = SwitchDefaults.colors(checkedTrackColor = Dakly.colors.leaf))
            }
            PrimaryButton(stringResource(R.string.save), Modifier.fillMaxWidth(), enabled = title.trim().length >= 2, loading = saving) {
                saving = true
                scope.launch {
                    try {
                        val b = KnowledgeBody(type, title.trim(), body.trim().ifBlank { null }, if (type == "product") price.toLongOrNull() else null, active)
                        if (id == null) repo.addKnowledge(b) else repo.updateKnowledge(id, b)
                        ctx.toast(ctx.getString(R.string.saved))
                        nav.popBackStack()
                    } catch (e: Exception) { ctx.toastError(e) } finally { saving = false }
                }
            }
        }
    }
    if (confirmDelete && id != null) {
        ConfirmDialog(stringResource(R.string.kb_delete_title), stringResource(R.string.kb_delete_body), stringResource(R.string.delete), destructive = true,
            onConfirm = { scope.launch { try { repo.deleteKnowledge(id); nav.popBackStack() } catch (e: Exception) { ctx.toastError(e) } } },
            onDismiss = { confirmDelete = false })
    }
}

private fun knowledgeHint(t: String): Int = when (t) {
    "product" -> R.string.kb_product_hint
    "policy" -> R.string.kb_policy_hint
    "faq" -> R.string.kb_faq_hint
    "voice" -> R.string.kb_voice_hint
    else -> R.string.kb_note_hint
}
