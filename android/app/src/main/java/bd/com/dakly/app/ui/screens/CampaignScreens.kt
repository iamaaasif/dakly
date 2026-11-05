package bd.com.dakly.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.RadioButtonUnchecked
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import bd.com.dakly.app.R
import bd.com.dakly.app.data.ApiException
import bd.com.dakly.app.data.Audience
import bd.com.dakly.app.data.CampaignRow
import bd.com.dakly.app.data.NewCampaign
import bd.com.dakly.app.ui.LocalRepo
import bd.com.dakly.app.ui.Routes
import bd.com.dakly.app.ui.channelLabel
import bd.com.dakly.app.ui.components.Banner
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
import bd.com.dakly.app.ui.components.StatTile
import bd.com.dakly.app.ui.components.segmentColors
import bd.com.dakly.app.ui.components.statusColors
import bd.com.dakly.app.ui.rememberLoad
import bd.com.dakly.app.ui.segmentHint
import bd.com.dakly.app.ui.segmentLabel
import bd.com.dakly.app.ui.statusLabel
import bd.com.dakly.app.ui.theme.Dakly
import bd.com.dakly.app.ui.toast
import bd.com.dakly.app.ui.toastError
import bd.com.dakly.app.util.Format
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneOffset
import java.time.ZonedDateTime

// ============================================================ list

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CampaignsScreen(nav: NavHostController) {
    val repo = LocalRepo.current
    val data = rememberLoad { repo.campaigns() }
    ScreenFrame(
        stringResource(R.string.campaigns_title), subtitle = stringResource(R.string.campaigns_subtitle),
        fab = { DFab(stringResource(R.string.campaigns_new), Icons.Outlined.Add) { nav.navigate(Routes.newCampaign()) } },
    ) { inner ->
        Box(Modifier.padding(inner)) {
            LoadContent(data.value, data::reload) { list ->
                PullToRefreshBox((data.value as? Load.Ready)?.refreshing == true, onRefresh = data::reload) {
                    if (list.items.isEmpty()) {
                        EmptyState(Icons.Outlined.Campaign, stringResource(R.string.campaigns_empty_title), stringResource(R.string.campaigns_empty_body),
                            stringResource(R.string.campaigns_first)) { nav.navigate(Routes.newCampaign("inactive")) }
                    } else LazyColumn(contentPadding = ContentPadding, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(list.items, key = { it.id }) { c -> CampaignRowCard(c) { nav.navigate(Routes.campaign(c.id)) } }
                    }
                }
            }
        }
    }
}

@Composable
private fun CampaignRowCard(c: CampaignRow, onClick: () -> Unit) {
    val ctx = LocalContext.current
    val (sf, sb) = statusColors(c.status)
    val (gf, gb) = segmentColors(c.segment)
    DCard(onClick = onClick) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(c.name, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                Pill(stringResource(statusLabel(c.status)), sf, sb)
            }
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Pill(stringResource(segmentLabel(c.segment)), gf, gb)
                c.channels.forEach { Pill(stringResource(channelLabel(it)), Dakly.colors.ink2, Dakly.colors.sunk) }
                Spacer(Modifier.weight(1f))
                Text(ctx.resources.getQuantityString(R.plurals.recipients_count, c.recipients, Format.number(ctx, c.recipients)), color = Dakly.colors.ink3, fontSize = 12.sp)
            }
            val whenIso = c.sentAt ?: c.sendAt ?: c.createdAt
            Text(Format.dateTime(ctx, whenIso), color = Dakly.colors.ink3, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
        }
    }
}

// ============================================================ wizard

private val segmentsOrder = listOf("inactive", "vip", "regular", "new", "all")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CampaignWizardScreen(nav: NavHostController, initialSegment: String?, initialOffer: String) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val audience = rememberLoad { repo.audience() }

    var step by rememberSaveable { mutableStateOf(if (initialSegment != null) 1 else 0) }
    var segment by rememberSaveable { mutableStateOf(initialSegment ?: "inactive") }
    var voice by rememberSaveable { mutableStateOf(false) }
    var wa by rememberSaveable { mutableStateOf(true) }
    var sms by rememberSaveable { mutableStateOf(false) }
    var offer by rememberSaveable { mutableStateOf(initialOffer) }
    var message by rememberSaveable { mutableStateOf("") }
    var name by rememberSaveable { mutableStateOf("") }
    var later by rememberSaveable { mutableStateOf(false) }
    var sendAt by rememberSaveable { mutableStateOf<String?>(null) }
    var writing by remember { mutableStateOf(false) }
    var sending by remember { mutableStateOf(false) }
    var pickDate by remember { mutableStateOf(false) }
    var pickTime by remember { mutableStateOf<LocalDate?>(null) }

    val steps = 4
    ScreenFrame(
        stringResource(R.string.campaigns_new), subtitle = stringResource(R.string.wizard_step, step + 1, steps),
        onBack = { if (step > 0) step-- else nav.popBackStack() },
    ) { inner ->
        Column(Modifier.padding(inner).fillMaxSize().imePadding()) {
            LinearProgressIndicator(
                progress = { (step + 1f) / steps }, color = Dakly.colors.dak, trackColor = Dakly.colors.sunk,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).height(4.dp).clip(RoundedCornerShape(2.dp)),
            )
            LoadContent(audience.value, audience::reload) { a ->
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    when (step) {
                        0 -> {
                            Text(stringResource(R.string.wizard_who), style = MaterialTheme.typography.titleLarge)
                            segmentsOrder.forEach { k ->
                                val n = when (k) { "vip" -> a.counts.vip; "regular" -> a.counts.regular; "new" -> a.counts.new; "inactive" -> a.counts.inactive; else -> a.counts.all }
                                SelectRow(
                                    selected = segment == k, title = stringResource(segmentLabel(k)), body = stringResource(segmentHint(k)),
                                    trailing = Format.number(ctx, n), accent = segmentColors(k).first,
                                ) { segment = k }
                            }
                        }
                        1 -> {
                            Text(stringResource(R.string.wizard_how), style = MaterialTheme.typography.titleLarge)
                            SelectRow(!voice, stringResource(R.string.wizard_text), stringResource(R.string.wizard_text_hint)) { voice = false }
                            if (!voice) {
                                CheckRow(wa, stringResource(R.string.ch_whatsapp), if (a.channels.wa) null else stringResource(R.string.wizard_test_mode)) { wa = it }
                                CheckRow(sms, stringResource(R.string.ch_sms), if (a.channels.sms) null else stringResource(R.string.wizard_test_mode)) { sms = it }
                            }
                            SelectRow(
                                voice, stringResource(R.string.ch_voice),
                                if (a.channels.voiceAllowedOnPlan) stringResource(R.string.wizard_voice_hint) else stringResource(R.string.wizard_voice_plan),
                                enabled = a.channels.voiceAllowedOnPlan,
                            ) { voice = true }
                            Text(stringResource(R.string.wizard_messages_left, Format.number(ctx, a.messagesLeft)), color = Dakly.colors.ink3, fontSize = 13.sp)
                        }
                        2 -> {
                            Text(stringResource(if (voice) R.string.wizard_script else R.string.wizard_message), style = MaterialTheme.typography.titleLarge)
                            Field(offer, { offer = it }, stringResource(R.string.wizard_offer), hint = stringResource(R.string.wizard_offer_hint))
                            SecondaryButton(
                                stringResource(R.string.wizard_ai_write), Modifier.fillMaxWidth(), icon = Icons.Outlined.AutoAwesome,
                                enabled = !writing && offer.isNotBlank(),
                            ) {
                                writing = true
                                scope.launch {
                                    try { message = repo.aiMessage(segment, offer.trim(), if (voice) "voice" else "text").text } catch (e: Exception) { ctx.toastError(e) } finally { writing = false }
                                }
                            }
                            if (writing) LinearProgressIndicator(Modifier.fillMaxWidth(), color = Dakly.colors.dak)
                            Field(message, { message = it }, stringResource(R.string.wizard_message_field), singleLine = false, minLines = 6,
                                supporting = stringResource(R.string.wizard_placeholders))
                        }
                        else -> {
                            Text(stringResource(R.string.wizard_review), style = MaterialTheme.typography.titleLarge)
                            DCard {
                                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    ReviewLine(stringResource(R.string.wizard_to), stringResource(segmentLabel(segment)) + " · " + Format.number(ctx, countFor(a, segment)))
                                    ReviewLine(stringResource(R.string.wizard_via), channelsFor(voice, wa, sms).joinToString(", ") { ctx.getString(channelLabel(it)) })
                                    Text(message.replace("{name}", "…").replace("{নাম}", "…"), color = Dakly.colors.ink2, modifier = Modifier.padding(top = 4.dp))
                                }
                            }
                            Field(name, { name = it }, stringResource(R.string.wizard_name))
                            SelectRow(!later, stringResource(R.string.wizard_now), null) { later = false }
                            SelectRow(later, stringResource(R.string.wizard_later), a.bestTime?.label?.let { stringResource(R.string.home_best_time, it) }) {
                                later = true
                                if (sendAt == null) sendAt = a.bestTime?.nextAt
                                pickDate = true
                            }
                            if (later && sendAt != null) {
                                DCard(onClick = { pickDate = true }, padding = 12.dp) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Outlined.Schedule, null, tint = Dakly.colors.sky)
                                        Spacer(Modifier.width(10.dp))
                                        Text(Format.dateTime(ctx, sendAt), fontWeight = FontWeight.SemiBold)
                                    }
                                }
                            }
                            if (!a.channels.wa && !voice && wa) Banner(stringResource(R.string.wizard_wa_test_banner), Dakly.colors.haldi, Dakly.colors.haldiSoft)
                        }
                    }
                }
                Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (step > 0) SecondaryButton(stringResource(R.string.back), Modifier.weight(1f)) { step-- }
                    val canNext = when (step) {
                        0 -> countFor(a, segment) > 0
                        1 -> voice || wa || sms
                        2 -> message.trim().length >= 5
                        else -> !later || sendAt != null
                    }
                    PrimaryButton(
                        stringResource(if (step < steps - 1) R.string.next else if (later) R.string.wizard_schedule else R.string.wizard_send),
                        Modifier.weight(1f), enabled = canNext, loading = sending,
                    ) {
                        if (step < steps - 1) { step++; return@PrimaryButton }
                        sending = true
                        scope.launch {
                            try {
                                val r = repo.createCampaign(
                                    NewCampaign(
                                        name = name.ifBlank { null }, segment = segment, message = message.trim(),
                                        channels = channelsFor(voice, wa, sms), `when` = if (later) "later" else "now",
                                        sendAt = if (later) sendAt else null,
                                    ),
                                )
                                ctx.toast(ctx.getString(if (later) R.string.wizard_scheduled_ok else R.string.wizard_sent_ok))
                                nav.popBackStack()
                                nav.navigate(Routes.campaign(r.id))
                            } catch (e: ApiException) {
                                ctx.toastError(e)
                            } catch (e: Exception) {
                                ctx.toastError(e)
                            } finally { sending = false }
                        }
                    }
                }
            }
        }
    }

    if (pickDate) {
        val initial = Format.pickerDay(Format.parseInstant(sendAt))
        val state = rememberDatePickerState(initialSelectedDateMillis = initial)
        DatePickerDialog(
            onDismissRequest = { pickDate = false },
            confirmButton = {
                TextButton(onClick = {
                    pickDate = false
                    state.selectedDateMillis?.let { pickTime = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate() }
                }) { Text(stringResource(R.string.next)) }
            },
            dismissButton = { TextButton(onClick = { pickDate = false }) { Text(stringResource(R.string.cancel)) } },
        ) { DatePicker(state) }
    }
    pickTime?.let { date ->
        val cur = Format.parseInstant(sendAt)?.atZone(Format.shopZone)?.toLocalTime() ?: LocalTime.of(20, 0)
        val state = rememberTimePickerState(cur.hour, cur.minute)
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { pickTime = null },
            confirmButton = {
                TextButton(onClick = {
                    val at = ZonedDateTime.of(date, LocalTime.of(state.hour, state.minute), Format.shopZone).toInstant()
                    if (at.isBefore(Instant.now().plusSeconds(60))) ctx.toast(ctx.getString(R.string.wizard_future))
                    else { sendAt = at.toString(); pickTime = null }
                }) { Text(stringResource(R.string.ok)) }
            },
            dismissButton = { TextButton(onClick = { pickTime = null }) { Text(stringResource(R.string.cancel)) } },
            text = { TimePicker(state) },
        )
    }
}

private fun countFor(a: Audience, s: String) = when (s) {
    "vip" -> a.counts.vip; "regular" -> a.counts.regular; "new" -> a.counts.new; "inactive" -> a.counts.inactive; else -> a.counts.all
}

private fun channelsFor(voice: Boolean, wa: Boolean, sms: Boolean): List<String> =
    if (voice) listOf("voice") else listOfNotNull(if (wa) "wa" else null, if (sms) "sms" else null)

@Composable
fun SelectRow(
    selected: Boolean, title: String, body: String?, trailing: String? = null, accent: Color = Dakly.colors.dak,
    enabled: Boolean = true, onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        Modifier.fillMaxWidth().clip(shape)
            .background(if (selected) Dakly.colors.dakSoft else Dakly.colors.surface)
            .border(1.dp, if (selected) Dakly.colors.dak else Dakly.colors.line, shape)
            .clickable(enabled = enabled, onClick = onClick).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(if (selected) Icons.Outlined.CheckCircle else Icons.Outlined.RadioButtonUnchecked, null, tint = if (selected) Dakly.colors.dak else Dakly.colors.ink3)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.SemiBold, color = if (enabled) Dakly.colors.ink else Dakly.colors.ink3)
            if (body != null) Text(body, color = Dakly.colors.ink3, fontSize = 12.5.sp)
        }
        if (trailing != null) Text(trailing, style = MaterialTheme.typography.titleLarge, color = accent)
    }
}

@Composable
private fun CheckRow(checked: Boolean, title: String, note: String?, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().clickable { onChange(!checked) }.padding(start = 28.dp), verticalAlignment = Alignment.CenterVertically) {
        Checkbox(checked, onChange, colors = CheckboxDefaults.colors(checkedColor = Dakly.colors.dak))
        Column {
            Text(title)
            if (note != null) Text(note, color = Dakly.colors.haldi, fontSize = 12.sp)
        }
    }
}

@Composable
private fun ReviewLine(label: String, value: String) {
    Row {
        Text(label, color = Dakly.colors.ink3, modifier = Modifier.width(90.dp))
        Text(value, fontWeight = FontWeight.SemiBold)
    }
}

// ============================================================ detail

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CampaignDetailScreen(nav: NavHostController, id: String) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val data = rememberLoad(id) { repo.campaign(id) }
    ScreenFrame(data.data()?.name ?: stringResource(R.string.campaign_title), onBack = { nav.popBackStack() }) { inner ->
        Box(Modifier.padding(inner)) {
            LoadContent(data.value, data::reload) { c ->
                PullToRefreshBox((data.value as? Load.Ready)?.refreshing == true, onRefresh = data::reload) {
                    LazyColumn(contentPadding = ContentPadding, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        item {
                            val (sf, sb) = statusColors(c.status)
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                                Pill(stringResource(statusLabel(c.status)), sf, sb)
                                Pill(stringResource(segmentLabel(c.segment)), segmentColors(c.segment).first, segmentColors(c.segment).second)
                                c.channels.forEach { Pill(stringResource(channelLabel(it)), Dakly.colors.ink2, Dakly.colors.sunk) }
                            }
                            Text(Format.dateTime(ctx, c.sentAt ?: c.sendAt ?: c.createdAt), color = Dakly.colors.ink3, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
                        }
                        item {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                StatTile(Format.number(ctx, c.summary.sent), stringResource(R.string.cs_sent), Modifier.weight(1f))
                                StatTile(Format.number(ctx, c.summary.delivered), stringResource(R.string.st_delivered), Modifier.weight(1f))
                                StatTile(Format.number(ctx, c.summary.read), stringResource(R.string.cs_read), Modifier.weight(1f), Dakly.colors.leaf)
                            }
                        }
                        item {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                StatTile(Format.number(ctx, c.summary.interested), stringResource(R.string.st_interested), Modifier.weight(1f), Dakly.colors.dak)
                                StatTile(Format.number(ctx, c.summary.failed), stringResource(R.string.st_failed), Modifier.weight(1f))
                                StatTile(Format.number(ctx, c.summary.test + c.summary.skipped), stringResource(R.string.cs_test_skipped), Modifier.weight(1f))
                            }
                        }
                        if (c.summary.test > 0) item { Banner(stringResource(R.string.campaign_test_banner), Dakly.colors.haldi, Dakly.colors.haldiSoft) }
                        item {
                            DCard { Text(c.message, color = Dakly.colors.ink2) }
                        }
                        item { SectionTitle(stringResource(R.string.campaign_recipients)) }
                        items(c.messages, key = { it.id }) { m ->
                            DCard(onClick = { m.customer?.id?.let { nav.navigate(Routes.customer(it)) } }, padding = 12.dp) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Column(Modifier.weight(1f)) {
                                        Text(m.customer?.name.orEmpty(), fontWeight = FontWeight.SemiBold)
                                        Text(Format.phone(m.customer?.phone) + " · " + stringResource(channelLabel(m.channel)), color = Dakly.colors.ink3, fontSize = 12.sp)
                                        if (!m.error.isNullOrBlank()) Text(m.error, color = Dakly.colors.dak, fontSize = 12.sp)
                                    }
                                    val (f, b) = statusColors(m.status)
                                    Pill(stringResource(statusLabel(m.status)), f, b)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
