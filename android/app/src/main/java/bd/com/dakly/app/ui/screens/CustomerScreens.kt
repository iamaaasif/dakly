package bd.com.dakly.app.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.FileDownload
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Lightbulb
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material.icons.outlined.Sms
import androidx.compose.material.icons.outlined.Sort
import androidx.compose.material.icons.outlined.Stop
import androidx.compose.material.icons.outlined.UploadFile
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.navigation.NavHostController
import bd.com.dakly.app.R
import bd.com.dakly.app.data.CustomerDetail
import bd.com.dakly.app.data.CustomerPatch
import bd.com.dakly.app.data.CustomerRow
import bd.com.dakly.app.data.ImportPreview
import bd.com.dakly.app.data.ImportResult
import bd.com.dakly.app.data.NewCustomer
import bd.com.dakly.app.data.NewOrder
import bd.com.dakly.app.ui.LocalRepo
import bd.com.dakly.app.ui.Routes
import bd.com.dakly.app.ui.components.Avatar
import bd.com.dakly.app.ui.components.Banner
import bd.com.dakly.app.ui.components.ChoiceChips
import bd.com.dakly.app.ui.components.ConfirmDialog
import bd.com.dakly.app.ui.components.ContentPadding
import bd.com.dakly.app.ui.components.DCard
import bd.com.dakly.app.ui.components.DFab
import bd.com.dakly.app.ui.components.EmptyState
import bd.com.dakly.app.ui.components.ErrorState
import bd.com.dakly.app.ui.components.Field
import bd.com.dakly.app.ui.components.LoadContent
import bd.com.dakly.app.ui.components.Pill
import bd.com.dakly.app.ui.components.PrimaryButton
import bd.com.dakly.app.ui.components.ScreenFrame
import bd.com.dakly.app.ui.components.SecondaryButton
import bd.com.dakly.app.ui.components.SectionTitle
import bd.com.dakly.app.ui.components.StatTile
import bd.com.dakly.app.ui.components.plus
import bd.com.dakly.app.ui.components.segmentColors
import bd.com.dakly.app.ui.errorMessage
import bd.com.dakly.app.ui.rememberLoad
import bd.com.dakly.app.ui.segmentLabel
import bd.com.dakly.app.ui.theme.Dakly
import bd.com.dakly.app.ui.toast
import bd.com.dakly.app.ui.toastError
import bd.com.dakly.app.util.Contact
import bd.com.dakly.app.util.Format
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.launch
import java.io.File

private val segmentFilters = listOf<String?>(null, "vip", "regular", "new", "inactive")

// ============================================================ list

@Composable
fun CustomersScreen(nav: NavHostController) {
    var exporting by remember { mutableStateOf(false) }
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var q by rememberSaveable { mutableStateOf("") }
    var debounced by rememberSaveable { mutableStateOf("") }
    var segment by rememberSaveable { mutableStateOf<String?>(null) }
    var sort by rememberSaveable { mutableStateOf("recent") }
    var sortMenu by remember { mutableStateOf(false) }
    var addMenu by remember { mutableStateOf(false) }

    val items = remember { mutableStateListOf<CustomerRow>() }
    var page by remember { mutableStateOf(1) }
    var hasMore by remember { mutableStateOf(false) }
    var total by remember { mutableStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<Throwable?>(null) }
    var reloadTick by remember { mutableStateOf(0) }

    LaunchedEffect(q) { delay(350); debounced = q.trim() }

    suspend fun load(reset: Boolean) {
        loading = true
        try {
            val p = if (reset) 1 else page + 1
            val r = repo.customers(debounced.ifBlank { null }, segment, sort, p)
            if (reset) items.clear()
            items.addAll(r.items)
            page = r.page
            hasMore = r.hasMore
            total = r.total
            error = null
        } catch (e: Exception) {
            if (items.isEmpty()) error = e else ctx.toastError(e)
        } finally {
            loading = false
        }
    }

    LaunchedEffect(debounced, segment, sort, reloadTick) { load(reset = true) }

    val listState = rememberLazyListState()
    LaunchedEffect(listState) {
        snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0 }
            .distinctUntilChanged()
            .filter { it >= items.size - 5 }
            .collect { if (hasMore && !loading) load(reset = false) }
    }

    ScreenFrame(
        title = stringResource(R.string.customers_title),
        subtitle = stringResource(R.string.customers_total, Format.number(ctx, total)),
        actions = {
            IconButton(onClick = {
                if (!exporting) {
                    exporting = true
                    scope.launch {
                        try {
                            val f = repo.exportCustomers(java.io.File(ctx.cacheDir, "exports"))
                            bd.com.dakly.app.util.Share.file(ctx, f, "text/csv", ctx.getString(R.string.export_share))
                        } catch (e: Exception) { ctx.toastError(e) } finally { exporting = false }
                    }
                }
            }) { Icon(Icons.Outlined.FileDownload, stringResource(R.string.export_customers)) }
            Box {
                IconButton(onClick = { sortMenu = true }) { Icon(Icons.Outlined.Sort, stringResource(R.string.sort)) }
                DropdownMenu(sortMenu, onDismissRequest = { sortMenu = false }) {
                    listOf("recent" to R.string.sort_recent, "total" to R.string.sort_total, "name" to R.string.sort_name).forEach { (k, l) ->
                        DropdownMenuItem(
                            text = { Text(stringResource(l), fontWeight = if (k == sort) FontWeight.Bold else FontWeight.Normal) },
                            onClick = { sort = k; sortMenu = false },
                        )
                    }
                }
            }
        },
        fab = {
            Box {
                DFab(stringResource(R.string.customers_add), Icons.Outlined.PersonAdd) { addMenu = true }
                DropdownMenu(addMenu, onDismissRequest = { addMenu = false }) {
                    DropdownMenuItem(text = { Text(stringResource(R.string.qa_add_customer)) }, leadingIcon = { Icon(Icons.Outlined.PersonAdd, null) },
                        onClick = { addMenu = false; nav.navigate(Routes.newCustomer()) })
                    DropdownMenuItem(text = { Text(stringResource(R.string.qa_voice)) }, leadingIcon = { Icon(Icons.Outlined.Mic, null) },
                        onClick = { addMenu = false; nav.navigate(Routes.newCustomer(voice = true)) })
                    DropdownMenuItem(text = { Text(stringResource(R.string.qa_import)) }, leadingIcon = { Icon(Icons.Outlined.UploadFile, null) },
                        onClick = { addMenu = false; nav.navigate(Routes.IMPORT) })
                }
            }
        },
    ) { inner ->
        Column(Modifier.padding(inner)) {
            OutlinedTextField(
                value = q, onValueChange = { q = it }, singleLine = true,
                leadingIcon = { Icon(Icons.Outlined.Search, null) },
                placeholder = { Text(stringResource(R.string.customers_search)) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                shape = RoundedCornerShape(14.dp),
            )
            Spacer(Modifier.height(10.dp))
            ChoiceChips(
                segmentFilters, segment, label = { stringResource(segmentLabel(it)) }, onSelect = { segment = it },
                modifier = Modifier.padding(horizontal = 16.dp),
            )
            Spacer(Modifier.height(6.dp))
            when {
                error != null && items.isEmpty() -> ErrorState(error!!) { reloadTick++ }
                loading && items.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Dakly.colors.dak) }
                items.isEmpty() -> EmptyState(
                    Icons.Outlined.People, stringResource(R.string.customers_empty_title), stringResource(R.string.customers_empty_body),
                    stringResource(R.string.qa_import),
                ) { nav.navigate(Routes.IMPORT) }
                else -> LazyColumn(state = listState, contentPadding = ContentPadding, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(items, key = { it.id }) { c ->
                        CustomerRowCard(c,
                            onOpen = { nav.navigate(Routes.customer(c.id)) },
                            onCall = { Contact.call(ctx, "+" + c.phone); scope.launch { runCatching { repo.logCall(c.id, "phone") } } },
                            onWhatsApp = { Contact.whatsapp(ctx, c.phone); scope.launch { runCatching { repo.logCall(c.id, "whatsapp") } } },
                        )
                    }
                    if (hasMore) item { Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(Modifier.size(24.dp), color = Dakly.colors.dak) } }
                }
            }
        }
    }
}

@Composable
private fun CustomerRowCard(c: CustomerRow, onOpen: () -> Unit, onCall: () -> Unit, onWhatsApp: () -> Unit) {
    val ctx = LocalContext.current
    val (fg, bg) = segmentColors(c.segment)
    DCard(onClick = onOpen, padding = 12.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(c.name)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(c.name, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                    Spacer(Modifier.width(6.dp))
                    Pill(stringResource(segmentLabel(c.segment)), fg, bg)
                    if (c.optedOut) {
                        Spacer(Modifier.width(4.dp))
                        Pill("STOP", Dakly.colors.ink2, Dakly.colors.sunk)
                    }
                }
                Text(
                    Format.phone(c.phone) + (c.stats.last?.let { " · " + ctx.getString(R.string.customers_last_bought, Format.relative(ctx, it)) } ?: ""),
                    color = Dakly.colors.ink3, fontSize = 12.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
                Text(Format.money(ctx, c.stats.total.toDouble()) + " · " + ctx.resources.getQuantityString(R.plurals.orders_count, c.stats.count, Format.number(ctx, c.stats.count)),
                    color = Dakly.colors.ink2, fontSize = 12.5.sp)
            }
            IconButton(onClick = onCall) { Icon(Icons.Outlined.Call, stringResource(R.string.action_call), tint = Dakly.colors.ink2) }
            IconButton(onClick = onWhatsApp) { Icon(painterWhatsApp(), stringResource(R.string.action_whatsapp), tint = Dakly.colors.leaf) }
        }
    }
}

/** WhatsApp-ish chat glyph; Material has no WhatsApp brand icon, and we must not ship its logo. */
@Composable
fun painterWhatsApp(): ImageVector = Icons.Outlined.ChatBubbleOutline

// ============================================================ detail

@Composable
fun CustomerDetailScreen(nav: NavHostController, id: String) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val data = rememberLoad(id) { repo.customer(id) }
    var addOrder by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var editNote by remember { mutableStateOf(false) }

    ScreenFrame(
        title = data.data()?.name ?: stringResource(R.string.customer_title),
        onBack = { nav.popBackStack() },
        actions = { IconButton(onClick = { confirmDelete = true }) { Icon(Icons.Outlined.Delete, stringResource(R.string.delete)) } },
    ) { inner ->
        Box(Modifier.padding(inner)) {
            LoadContent(data.value, data::reload) { c ->
                CustomerDetailContent(
                    c,
                    onCall = { Contact.call(ctx, "+" + c.phone); scope.launch { runCatching { repo.logCall(c.id, "phone") } } },
                    onWhatsApp = { Contact.whatsapp(ctx, c.phone); scope.launch { runCatching { repo.logCall(c.id, "whatsapp") } } },
                    onSms = { Contact.sms(ctx, "+" + c.phone) },
                    onChat = { nav.navigate(Routes.chat(c.id)) },
                    onOffer = { nav.navigate(Routes.newCampaign(c.segment, c.recommendation?.product)) },
                    onAddOrder = { addOrder = true },
                    onEditNote = { editNote = true },
                    onOptOut = { v ->
                        scope.launch {
                            try { repo.updateCustomer(c.id, CustomerPatch(optedOut = v)); data.set(c.copy(optedOut = v)) } catch (e: Exception) { ctx.toastError(e) }
                        }
                    },
                )
            }
        }
    }

    val c = data.data()
    if (addOrder && c != null) {
        OrderDialog(onDismiss = { addOrder = false }) { amount, items ->
            scope.launch {
                try {
                    repo.addOrder(c.id, NewOrder(amount, items.ifBlank { null }))
                    addOrder = false
                    data.reload()
                } catch (e: Exception) { ctx.toastError(e) }
            }
        }
    }
    if (editNote && c != null) {
        NoteDialog(c, onDismiss = { editNote = false }) { patch ->
            scope.launch {
                try { repo.updateCustomer(c.id, patch); editNote = false; data.reload() } catch (e: Exception) { ctx.toastError(e) }
            }
        }
    }
    if (confirmDelete) {
        ConfirmDialog(
            stringResource(R.string.customer_delete_title), stringResource(R.string.customer_delete_body),
            stringResource(R.string.delete), destructive = true,
            onConfirm = {
                scope.launch {
                    try { repo.deleteCustomer(id); nav.popBackStack() } catch (e: Exception) { ctx.toastError(e) }
                }
            },
            onDismiss = { confirmDelete = false },
        )
    }
}

@Composable
private fun CustomerDetailContent(
    c: CustomerDetail,
    onCall: () -> Unit, onWhatsApp: () -> Unit, onSms: () -> Unit, onChat: () -> Unit, onOffer: () -> Unit,
    onAddOrder: () -> Unit, onEditNote: () -> Unit, onOptOut: (Boolean) -> Unit,
) {
    val ctx = LocalContext.current
    val (fg, bg) = segmentColors(c.segment)
    LazyColumn(contentPadding = ContentPadding, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Avatar(c.name, 56.dp, bg, fg)
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(c.name, style = MaterialTheme.typography.headlineSmall)
                    Text(Format.phone(c.phone), color = Dakly.colors.ink2)
                    Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Pill(stringResource(segmentLabel(c.segment)), fg, bg)
                        c.area?.takeIf { it.isNotBlank() }?.let { Pill(it, Dakly.colors.ink2, Dakly.colors.sunk) }
                    }
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ContactButton(Icons.Outlined.Call, stringResource(R.string.action_call), Modifier.weight(1f), onCall)
                ContactButton(painterWhatsApp(), stringResource(R.string.action_whatsapp), Modifier.weight(1f), onWhatsApp)
                ContactButton(Icons.Outlined.Sms, stringResource(R.string.action_sms), Modifier.weight(1f), onSms)
                ContactButton(Icons.Outlined.ChatBubbleOutline, stringResource(R.string.action_inbox), Modifier.weight(1f), onChat)
            }
        }
        item {
            Text(
                stringResource(if (c.chatWindowOpen) R.string.chat_window_open else R.string.chat_window_closed),
                color = Dakly.colors.ink3, fontSize = 12.sp,
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatTile(Format.money(ctx, c.total.toDouble(), c.currency), stringResource(R.string.customer_total_spent), Modifier.weight(1f))
                StatTile(Format.number(ctx, c.orders.size), stringResource(R.string.customer_orders), Modifier.weight(1f))
                StatTile(c.orders.firstOrNull()?.orderedAt?.let { Format.relative(ctx, it, narrow = true) } ?: "–", stringResource(R.string.customer_last_order), Modifier.weight(1f))
            }
        }
        c.recommendation?.let { r ->
            item {
                DCard(onClick = onOffer) {
                    Row {
                        IconBubble(Icons.Outlined.Lightbulb, Dakly.colors.haldi, Dakly.colors.haldiSoft)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(stringResource(R.string.customer_recommend, r.product), fontWeight = FontWeight.SemiBold)
                            Text(r.reason, color = Dakly.colors.ink2, fontSize = 13.sp)
                            Text(stringResource(R.string.home_send_offer), color = Dakly.colors.dak, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                }
            }
        }
        item { SectionTitle(stringResource(R.string.customer_orders), action = stringResource(R.string.customer_add_order), onAction = onAddOrder) }
        if (c.orders.isEmpty()) item { Text(stringResource(R.string.customer_no_orders), color = Dakly.colors.ink3) }
        items(c.orders, key = { it.id }) { o ->
            DCard(padding = 12.dp) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconBubble(Icons.Outlined.ShoppingBag, Dakly.colors.ink2, Dakly.colors.sunk)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(o.items?.takeIf { it.isNotBlank() } ?: stringResource(R.string.customer_order), maxLines = 2, overflow = TextOverflow.Ellipsis)
                        Text(Format.date(ctx, o.orderedAt), color = Dakly.colors.ink3, fontSize = 12.sp)
                    }
                    Text(Format.money(ctx, o.amount.toDouble(), c.currency), fontWeight = FontWeight.Bold)
                }
            }
        }
        item { SectionTitle(stringResource(R.string.customer_notes), action = stringResource(R.string.edit), onAction = onEditNote) }
        item {
            DCard(onClick = onEditNote) {
                Column {
                    Text(c.note?.takeIf { it.isNotBlank() } ?: stringResource(R.string.customer_no_note), color = if (c.note.isNullOrBlank()) Dakly.colors.ink3 else Dakly.colors.ink)
                    c.email?.takeIf { it.isNotBlank() }?.let { Text(it, color = Dakly.colors.ink2, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp)) }
                }
            }
        }
        item {
            DCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(stringResource(R.string.customer_opted_out), fontWeight = FontWeight.SemiBold)
                        Text(stringResource(R.string.customer_opted_out_hint), color = Dakly.colors.ink3, fontSize = 12.5.sp)
                    }
                    Switch(c.optedOut, onOptOut, colors = SwitchDefaults.colors(checkedTrackColor = Dakly.colors.dak))
                }
            }
        }
    }
}

@Composable
private fun ContactButton(icon: ImageVector, label: String, modifier: Modifier, onClick: () -> Unit) {
    Column(
        modifier.clip(RoundedCornerShape(14.dp)).background(Dakly.colors.surface).clickable(onClick = onClick).padding(vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, null, tint = Dakly.colors.dak)
        Spacer(Modifier.height(4.dp))
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

@Composable
private fun OrderDialog(onDismiss: () -> Unit, onSave: (Long, String) -> Unit) {
    var amount by rememberSaveable { mutableStateOf("") }
    var items by rememberSaveable { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.customer_add_order)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Field(amount, { amount = it.filter(Char::isDigit) }, stringResource(R.string.field_amount, Format.shopCurrency),
                    keyboard = KeyboardOptions(keyboardType = KeyboardType.Number))
                Field(items, { items = it }, stringResource(R.string.field_items))
            }
        },
        confirmButton = {
            TextButton(onClick = { amount.toLongOrNull()?.let { onSave(it, items) } }, enabled = (amount.toLongOrNull() ?: 0) > 0) {
                Text(stringResource(R.string.save), fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}

@Composable
private fun NoteDialog(c: CustomerDetail, onDismiss: () -> Unit, onSave: (CustomerPatch) -> Unit) {
    var name by rememberSaveable { mutableStateOf(c.name) }
    var area by rememberSaveable { mutableStateOf(c.area.orEmpty()) }
    var email by rememberSaveable { mutableStateOf(c.email.orEmpty()) }
    var note by rememberSaveable { mutableStateOf(c.note.orEmpty()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.customer_edit)) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Field(name, { name = it }, stringResource(R.string.field_name))
                Field(area, { area = it }, stringResource(R.string.field_area))
                Field(email, { email = it }, stringResource(R.string.field_email), keyboard = KeyboardOptions(keyboardType = KeyboardType.Email))
                Field(note, { note = it }, stringResource(R.string.customer_notes), singleLine = false, minLines = 3)
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(CustomerPatch(name = name.trim(), area = area.trim(), email = email.trim(), note = note.trim())) }, enabled = name.trim().length >= 2) {
                Text(stringResource(R.string.save), fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}

// ============================================================ add (manual + voice)

@Composable
fun NewCustomerScreen(nav: NavHostController, startWithVoice: Boolean) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var name by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var items by rememberSaveable { mutableStateOf("") }
    var amount by rememberSaveable { mutableStateOf("") }
    var area by rememberSaveable { mutableStateOf("") }
    var source by rememberSaveable { mutableStateOf("manual") }
    var saving by remember { mutableStateOf(false) }
    var heard by rememberSaveable { mutableStateOf<String?>(null) }

    val phoneError = if (phone.isNotBlank() && !Format.isValidPhone(phone)) stringResource(R.string.err_invalid_phone) else null

    ScreenFrame(stringResource(R.string.customer_new_title), onBack = { nav.popBackStack() }) { inner ->
        Column(
            Modifier.padding(inner).imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            VoiceCapture(autoStart = startWithVoice) { r ->
                heard = r.text
                r.parsed.name?.let { name = it }
                r.parsed.phone?.let { phone = it }
                r.parsed.items?.let { items = it }
                r.parsed.amount?.let { amount = it.toString() }
                source = "voice"
            }
            heard?.let { Banner(stringResource(R.string.voice_heard, it), Dakly.colors.leaf, Dakly.colors.leafSoft) }
            Field(name, { name = it }, stringResource(R.string.field_name))
            Field(phone, { phone = it }, stringResource(R.string.field_phone), hint = stringResource(R.string.field_phone_hint),
                keyboard = KeyboardOptions(keyboardType = KeyboardType.Phone), error = phoneError)
            Field(items, { items = it }, stringResource(R.string.field_items_optional))
            Field(amount, { amount = it.filter(Char::isDigit) }, stringResource(R.string.field_amount_optional, Format.shopCurrency),
                keyboard = KeyboardOptions(keyboardType = KeyboardType.Number))
            Field(area, { area = it }, stringResource(R.string.field_area_optional))
            PrimaryButton(
                stringResource(R.string.save_customer), Modifier.fillMaxWidth(),
                enabled = name.trim().length >= 2 && Format.isValidPhone(phone), loading = saving,
            ) {
                saving = true
                scope.launch {
                    try {
                        val r = repo.addCustomer(NewCustomer(name.trim(), phone.trim(), items.ifBlank { null }, amount.toLongOrNull(), area.ifBlank { null }, source))
                        ctx.toast(ctx.getString(R.string.customer_saved))
                        nav.popBackStack()
                        nav.navigate(Routes.customer(r.id))
                    } catch (e: Exception) {
                        ctx.toastError(e)
                    } finally { saving = false }
                }
            }
        }
    }
}

/** Records Bangla/English speech, sends it to /customers/voice and returns the extracted fields. */
@Composable
private fun VoiceCapture(autoStart: Boolean, onResult: (bd.com.dakly.app.data.VoiceResult) -> Unit) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var recording by remember { mutableStateOf(false) }
    var working by remember { mutableStateOf(false) }
    var seconds by remember { mutableStateOf(0) }
    val recorder = remember { mutableStateOf<MediaRecorder?>(null) }
    val file = remember { File(ctx.cacheDir, "voice-customer.m4a") }

    fun start() {
        file.delete()
        val r = if (Build.VERSION.SDK_INT >= 31) MediaRecorder(ctx) else @Suppress("DEPRECATION") MediaRecorder()
        try {
            r.setAudioSource(MediaRecorder.AudioSource.MIC)
            r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            r.setAudioSamplingRate(44100)
            r.setAudioEncodingBitRate(64000)
            r.setMaxDuration(60_000)
            r.setOutputFile(file.absolutePath)
            r.prepare()
            r.start()
            recorder.value = r
            recording = true
            seconds = 0
        } catch (e: Exception) {
            r.release()
            ctx.toastError(e)
        }
    }

    fun stopAndSend() {
        val r = recorder.value ?: return
        recorder.value = null
        recording = false
        runCatching { r.stop() }
        r.release()
        if (!file.exists() || file.length() < 1000) return
        working = true
        scope.launch {
            try { onResult(repo.voice(file, "audio/mp4")) } catch (e: Exception) { ctx.toastError(e) } finally { working = false }
        }
    }

    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) start() else ctx.toast(ctx.getString(R.string.mic_denied))
    }

    fun toggle() {
        if (recording) { stopAndSend(); return }
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) start()
        else permission.launch(Manifest.permission.RECORD_AUDIO)
    }

    LaunchedEffect(Unit) { if (autoStart) toggle() }
    LaunchedEffect(recording) {
        while (recording) { delay(1000); seconds++; if (seconds >= 60) stopAndSend() }
    }
    DisposableEffect(Unit) { onDispose { recorder.value?.let { runCatching { it.stop() }; it.release() } } }

    DCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(56.dp).clip(CircleShape).background(if (recording) Dakly.colors.dak else Dakly.colors.dakSoft)
                    .clickable(enabled = !working) { toggle() },
                contentAlignment = Alignment.Center,
            ) {
                if (working) CircularProgressIndicator(Modifier.size(24.dp), color = Dakly.colors.dak, strokeWidth = 2.dp)
                else Icon(if (recording) Icons.Outlined.Stop else Icons.Outlined.Mic, stringResource(R.string.qa_voice), tint = if (recording) Dakly.colors.dakInk else Dakly.colors.dak)
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    stringResource(
                        when {
                            working -> R.string.voice_working
                            recording -> R.string.voice_recording
                            else -> R.string.voice_title
                        },
                    ),
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    if (recording) "0:%02d".format(seconds) else stringResource(R.string.voice_hint),
                    color = Dakly.colors.ink3, fontSize = 12.5.sp,
                )
            }
        }
    }
}

// ============================================================ import

@Composable
fun ImportScreen(nav: NavHostController) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var file by remember { mutableStateOf<Triple<Uri, String, String>?>(null) }
    var preview by remember { mutableStateOf<ImportPreview?>(null) }
    var result by remember { mutableStateOf<ImportResult?>(null) }
    var busy by remember { mutableStateOf(false) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val name = ctx.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use {
            if (it.moveToFirst()) it.getString(0) else null
        } ?: "customers.xlsx"
        val mime = ctx.contentResolver.getType(uri)
            ?: if (name.endsWith(".csv", true)) "text/csv" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        file = Triple(uri, name, mime)
        preview = null
        result = null
        busy = true
        scope.launch {
            try { preview = repo.importPreview(uri, name, mime) } catch (e: Exception) { ctx.toastError(e); file = null } finally { busy = false }
        }
    }
    val mimes = arrayOf(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel",
        "text/csv", "text/comma-separated-values", "application/csv", "text/plain", "application/octet-stream",
    )

    ScreenFrame(stringResource(R.string.import_title), onBack = { nav.popBackStack() }) { inner ->
        Column(
            Modifier.padding(inner).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(stringResource(R.string.import_body), color = Dakly.colors.ink2)
            SecondaryButton(
                file?.second ?: stringResource(R.string.import_choose), Modifier.fillMaxWidth(), icon = Icons.Outlined.UploadFile,
                enabled = !busy,
            ) { picker.launch(mimes) }
            if (busy) Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Dakly.colors.dak) }

            preview?.let { p ->
                DCard {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(stringResource(R.string.import_found, Format.number(ctx, p.rows)), style = MaterialTheme.typography.titleMedium)
                        if (p.invalid > 0) Text(stringResource(R.string.import_invalid, Format.number(ctx, p.invalid)), color = Dakly.colors.dak, fontSize = 13.sp)
                        HorizontalDivider(color = Dakly.colors.line)
                        Text(stringResource(R.string.import_columns), fontWeight = FontWeight.SemiBold)
                        listOf(
                            R.string.field_name to p.mapping.name, R.string.field_phone to p.mapping.phone,
                            R.string.import_col_total to p.mapping.total, R.string.import_col_last to p.mapping.last,
                            R.string.import_col_count to p.mapping.count, R.string.field_email to p.mapping.email, R.string.field_area to p.mapping.area,
                        ).filter { it.second != null }.forEach { (label, col) ->
                            Row {
                                Text(stringResource(label), Modifier.weight(1f), color = Dakly.colors.ink2)
                                Text("← " + col, fontWeight = FontWeight.SemiBold)
                            }
                        }
                        if (p.mapping.phone == null) Text(stringResource(R.string.import_no_phone), color = Dakly.colors.dak)
                    }
                }
                PrimaryButton(
                    stringResource(R.string.import_confirm, Format.number(ctx, p.rows - p.invalid)), Modifier.fillMaxWidth(),
                    enabled = p.mapping.phone != null && p.rows - p.invalid > 0, loading = busy,
                ) {
                    val f = file ?: return@PrimaryButton
                    busy = true
                    scope.launch {
                        try { result = repo.importCustomers(f.first, f.second, f.third); preview = null } catch (e: Exception) { ctx.toastError(e) } finally { busy = false }
                    }
                }
            }

            result?.let { r ->
                DCard {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Outlined.CheckCircle, null, tint = Dakly.colors.leaf, modifier = Modifier.size(40.dp))
                        Spacer(Modifier.height(8.dp))
                        Text(stringResource(R.string.import_done), style = MaterialTheme.typography.titleMedium)
                        Text(
                            stringResource(R.string.import_done_body, Format.number(ctx, r.created), Format.number(ctx, r.updated), Format.number(ctx, r.skipped)),
                            color = Dakly.colors.ink2, textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(12.dp))
                        PrimaryButton(stringResource(R.string.import_see_customers)) { nav.popBackStack() }
                    }
                }
            }
        }
    }
}
