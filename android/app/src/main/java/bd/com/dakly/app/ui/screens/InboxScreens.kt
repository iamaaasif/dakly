package bd.com.dakly.app.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Done
import androidx.compose.material.icons.outlined.DoneAll
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import bd.com.dakly.app.R
import bd.com.dakly.app.data.ChatMessage
import bd.com.dakly.app.data.Conversation
import bd.com.dakly.app.data.Thread
import bd.com.dakly.app.ui.LocalRepo
import bd.com.dakly.app.ui.Routes
import bd.com.dakly.app.ui.channelLabel
import bd.com.dakly.app.ui.components.Avatar
import bd.com.dakly.app.ui.components.Banner
import bd.com.dakly.app.ui.components.ChoiceChips
import bd.com.dakly.app.ui.components.ContentPadding
import bd.com.dakly.app.ui.components.DCard
import bd.com.dakly.app.ui.components.EmptyState
import bd.com.dakly.app.ui.components.LoadContent
import bd.com.dakly.app.ui.components.Load
import bd.com.dakly.app.ui.components.ScreenFrame
import bd.com.dakly.app.ui.rememberLoad
import bd.com.dakly.app.ui.theme.Dakly
import bd.com.dakly.app.ui.toastError
import bd.com.dakly.app.util.Contact
import bd.com.dakly.app.util.Format
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId

// ============================================================ conversation list

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InboxScreen(nav: NavHostController, onUnread: (Int) -> Unit) {
    val repo = LocalRepo.current
    var q by rememberSaveable { mutableStateOf("") }
    var debounced by rememberSaveable { mutableStateOf("") }
    var unreadOnly by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(q) { delay(350); debounced = q.trim() }
    val data = rememberLoad(debounced, unreadOnly) { repo.inbox(debounced.ifBlank { null }, unreadOnly, null).also { onUnread(it.unreadTotal) } }

    // Light polling while the inbox is open, so new WhatsApp replies show up.
    LaunchedEffect(Unit) { while (true) { delay(20_000); data.reload() } }

    ScreenFrame(stringResource(R.string.inbox_title), subtitle = stringResource(R.string.inbox_subtitle)) { inner ->
        Column(Modifier.padding(inner)) {
            OutlinedTextField(
                value = q, onValueChange = { q = it }, singleLine = true,
                leadingIcon = { Icon(Icons.Outlined.Search, null) },
                placeholder = { Text(stringResource(R.string.customers_search)) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp), shape = RoundedCornerShape(14.dp),
            )
            Spacer(Modifier.height(10.dp))
            ChoiceChips(
                listOf(false, true), unreadOnly,
                label = { stringResource(if (it) R.string.inbox_unread else R.string.inbox_all) },
                onSelect = { unreadOnly = it }, modifier = Modifier.padding(horizontal = 16.dp),
            )
            LoadContent(data.value, data::reload) { page ->
                PullToRefreshBox((data.value as? Load.Ready)?.refreshing == true, onRefresh = data::reload) {
                    if (page.conversations.isEmpty()) {
                        EmptyState(Icons.Outlined.ChatBubbleOutline, stringResource(R.string.inbox_empty_title), stringResource(R.string.inbox_empty_body))
                    } else {
                        LazyColumn(contentPadding = ContentPadding, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(page.conversations, key = { it.customer.id }) { c ->
                                ConversationRow(c) { nav.navigate(Routes.chat(c.customer.id)) }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ConversationRow(c: Conversation, onClick: () -> Unit) {
    DCard(onClick = onClick, padding = 12.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(c.customer.name, 44.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(c.customer.name, fontWeight = if (c.unread > 0) FontWeight.Bold else FontWeight.SemiBold,
                        maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                    Text(c.last?.at?.let { Format.relative(it) }.orEmpty(), color = Dakly.colors.ink3, fontSize = 11.5.sp)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val prefix = if (c.last?.direction == "out") stringResource(R.string.inbox_you) + " " else ""
                    Text(
                        prefix + lastPreview(c),
                        color = if (c.unread > 0) Dakly.colors.ink else Dakly.colors.ink3, fontSize = 13.sp,
                        maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
                    )
                    if (c.unread > 0) {
                        Spacer(Modifier.width(6.dp))
                        Box(Modifier.clip(RoundedCornerShape(50)).background(Dakly.colors.leaf).padding(horizontal = 7.dp, vertical = 1.dp)) {
                            Text("${c.unread}", color = Dakly.colors.surface, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                if (c.windowOpen) Text(stringResource(R.string.inbox_window_open_short), color = Dakly.colors.leaf, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun lastPreview(c: Conversation): String {
    val l = c.last ?: return ""
    return when (l.kind) {
        "call" -> stringResource(R.string.chat_call_logged)
        "image" -> stringResource(R.string.chat_image)
        "audio" -> stringResource(R.string.chat_audio)
        else -> l.body.orEmpty()
    }
}

// ============================================================ chat

@Composable
fun ChatScreen(nav: NavHostController, customerId: String) {
    val repo = LocalRepo.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val messages = remember { mutableStateListOf<ChatMessage>() }
    var thread by remember { mutableStateOf<Thread?>(null) }
    var cursor by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<Throwable?>(null) }
    var text by rememberSaveable { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var suggesting by remember { mutableStateOf(false) }
    val list = rememberLazyListState()

    suspend fun refresh(scrollToEnd: Boolean) {
        try {
            val t = repo.thread(customerId)
            val grew = t.messages.size != messages.size || t.messages.lastOrNull()?.id != messages.lastOrNull()?.id
            thread = t
            if (messages.isEmpty() || grew) {
                // Keep older pages that were loaded; replace the newest page.
                val newestIds = t.messages.map { it.id }.toSet()
                val older = messages.filter { it.id !in newestIds && (it.createdAt ?: "") < (t.messages.firstOrNull()?.createdAt ?: "") }
                messages.clear()
                messages.addAll(older + t.messages)
                if (cursor == null) cursor = t.nextCursor
                if (scrollToEnd && messages.isNotEmpty()) list.scrollToItem(messages.size - 1)
                runCatching { repo.markRead(customerId) }
            }
            error = null
        } catch (e: Exception) {
            if (thread == null) error = e
        }
    }

    LaunchedEffect(customerId) {
        refresh(true)
        while (true) { delay(8_000); refresh(list.isNearEnd()) }
    }

    val t = thread
    ScreenFrame(
        title = t?.customer?.name ?: stringResource(R.string.chat_title),
        subtitle = t?.customer?.phone?.let { Format.phone(it) },
        onBack = { nav.popBackStack() },
        actions = {
            IconButton(onClick = {
                t?.customer?.phone?.let { ph ->
                    Contact.call(ctx, "+$ph")
                    scope.launch { runCatching { repo.logCall(customerId, "phone") } }
                }
            }) { Icon(Icons.Outlined.Call, stringResource(R.string.action_call)) }
            IconButton(onClick = {
                Contact.whatsapp(ctx, t?.customer?.phone)
                scope.launch { runCatching { repo.logCall(customerId, "whatsapp") } }
            }) { Icon(painterWhatsApp(), stringResource(R.string.action_whatsapp_call)) }
            IconButton(onClick = { nav.navigate(Routes.customer(customerId)) }) { Icon(Icons.Outlined.Person, stringResource(R.string.customer_title)) }
        },
    ) { inner ->
        Column(Modifier.padding(inner).fillMaxSize().imePadding()) {
            when {
                error != null && t == null -> Box(Modifier.weight(1f)) {
                    bd.com.dakly.app.ui.components.ErrorState(error!!) { scope.launch { refresh(true) } }
                }
                t == null -> Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Dakly.colors.accent) }
                else -> LazyColumn(
                    state = list, modifier = Modifier.weight(1f).fillMaxWidth(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    if (cursor != null) item {
                        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                            TextButton(onClick = {
                                scope.launch {
                                    try {
                                        val older = repo.thread(customerId, cursor)
                                        messages.addAll(0, older.messages.filter { o -> messages.none { it.id == o.id } })
                                        cursor = older.nextCursor
                                    } catch (e: Exception) { ctx.toastError(e) }
                                }
                            }) { Text(stringResource(R.string.chat_load_older), color = Dakly.colors.ink2) }
                        }
                    }
                    if (messages.isEmpty()) item {
                        EmptyState(Icons.Outlined.ChatBubbleOutline, stringResource(R.string.chat_empty_title), stringResource(R.string.chat_empty_body))
                    }
                    var lastDay: LocalDate? = null
                    messages.forEach { m ->
                        val day = Format.parseInstant(m.createdAt)?.atZone(Format.shopZone)?.toLocalDate()
                        if (day != null && day != lastDay) {
                            lastDay = day
                            item(key = "d$day") {
                                Box(Modifier.fillMaxWidth().padding(vertical = 6.dp), contentAlignment = Alignment.Center) {
                                    Text(Format.date(ctx, m.createdAt), color = Dakly.colors.ink3, fontSize = 11.5.sp,
                                        modifier = Modifier.clip(RoundedCornerShape(50)).background(Dakly.colors.sunk).padding(horizontal = 10.dp, vertical = 2.dp))
                                }
                            }
                        }
                        item(key = m.id) { Bubble(m) }
                    }
                }
            }

            if (t != null) {
                if (t.customer.optedOut && !t.windowOpen) {
                    Banner(stringResource(R.string.chat_opted_out), modifier = Modifier.padding(horizontal = 12.dp))
                } else if (!t.windowOpen) {
                    Text(
                        stringResource(R.string.chat_window_closed_hint), color = Dakly.colors.ink3, fontSize = 12.sp,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                } else t.windowEndsAt?.let {
                    Text(stringResource(R.string.chat_window_until, Format.time(ctx, it)), color = Dakly.colors.leaf, fontSize = 12.sp,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
                }
                Row(
                    Modifier.fillMaxWidth().background(Dakly.colors.surface).padding(8.dp),
                    verticalAlignment = Alignment.Bottom,
                ) {
                    IconButton(enabled = !suggesting && !(t.customer.optedOut && !t.windowOpen), onClick = {
                        suggesting = true
                        scope.launch {
                            try { text = repo.suggestReply(customerId).text } catch (e: Exception) { ctx.toastError(e) } finally { suggesting = false }
                        }
                    }) {
                        if (suggesting) CircularProgressIndicator(Modifier.size(20.dp), color = Dakly.colors.accent, strokeWidth = 2.dp)
                        else Icon(Icons.Outlined.AutoAwesome, stringResource(R.string.chat_ai_suggest), tint = Dakly.colors.haldi)
                    }
                    OutlinedTextField(
                        value = text, onValueChange = { text = it },
                        placeholder = { Text(stringResource(if (t.windowOpen) R.string.chat_placeholder else R.string.chat_placeholder_template)) },
                        modifier = Modifier.weight(1f), maxLines = 5, shape = RoundedCornerShape(20.dp),
                        enabled = !(t.customer.optedOut && !t.windowOpen),
                    )
                    Spacer(Modifier.width(6.dp))
                    FilledIconButton(
                        enabled = text.isNotBlank() && !sending,
                        onClick = {
                            val body = text.trim()
                            sending = true
                            scope.launch {
                                try {
                                    val r = repo.sendMessage(customerId, body)
                                    messages.add(ChatMessage(id = r.id.ifBlank { "local-" + System.nanoTime() }, direction = "out", kind = r.kind, body = body, status = r.status, createdAt = java.time.Instant.now().toString()))
                                    text = ""
                                    list.scrollToItem(maxOf(0, list.layoutInfo.totalItemsCount - 1))
                                } catch (e: Exception) { ctx.toastError(e) } finally { sending = false }
                            }
                        },
                        colors = IconButtonDefaults.filledIconButtonColors(containerColor = Dakly.colors.dak, contentColor = Dakly.colors.dakInk),
                    ) {
                        if (sending) CircularProgressIndicator(Modifier.size(18.dp), color = Dakly.colors.dakInk, strokeWidth = 2.dp)
                        else Icon(Icons.AutoMirrored.Outlined.Send, stringResource(R.string.send))
                    }
                }
            }
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListState.isNearEnd(): Boolean {
    val last = layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: return true
    return last >= layoutInfo.totalItemsCount - 2
}

@Composable
private fun Bubble(m: ChatMessage) {
    val ctx = LocalContext.current
    val out = m.direction == "out"
    if (m.kind == "call" || m.channel == "call") {
        Box(Modifier.fillMaxWidth().padding(vertical = 4.dp), contentAlignment = Alignment.Center) {
            Row(
                Modifier.clip(RoundedCornerShape(50)).background(Dakly.colors.sunk).padding(horizontal = 12.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.Call, null, Modifier.size(14.dp), tint = Dakly.colors.ink2)
                Spacer(Modifier.width(6.dp))
                Text((m.body?.takeIf { it.isNotBlank() } ?: stringResource(R.string.chat_call_logged)) + " · " + Format.time(ctx, m.createdAt),
                    fontSize = 12.sp, color = Dakly.colors.ink2)
            }
        }
        return
    }
    Box(Modifier.fillMaxWidth(), contentAlignment = if (out) Alignment.CenterEnd else Alignment.CenterStart) {
        Column(
            Modifier.widthIn(max = 300.dp)
                .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomStart = if (out) 16.dp else 4.dp, bottomEnd = if (out) 4.dp else 16.dp))
                .background(if (out) Dakly.colors.leafSoft else Dakly.colors.surface)
                .padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            if (m.kind == "template" || m.kind == "campaign") {
                Text(stringResource(if (m.kind == "campaign") R.string.chat_campaign else R.string.chat_template), color = Dakly.colors.ink3, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
            Text(
                when (m.kind) {
                    "image" -> m.body?.takeIf { it.isNotBlank() } ?: stringResource(R.string.chat_image)
                    "audio" -> stringResource(R.string.chat_audio)
                    else -> m.body.orEmpty()
                },
                color = Dakly.colors.ink,
            )
            Row(Modifier.align(Alignment.End), verticalAlignment = Alignment.CenterVertically) {
                if (m.channel == "sms") Text(stringResource(channelLabel("sms")) + " · ", fontSize = 10.5.sp, color = Dakly.colors.ink3)
                Text(Format.time(ctx, m.createdAt), fontSize = 10.5.sp, color = Dakly.colors.ink3)
                if (out) {
                    Spacer(Modifier.width(3.dp))
                    val (icon, tint) = when (m.status) {
                        "read" -> Icons.Outlined.DoneAll to Dakly.colors.sky
                        "delivered" -> Icons.Outlined.DoneAll to Dakly.colors.ink3
                        "sent", "test" -> Icons.Outlined.Done to Dakly.colors.ink3
                        "failed" -> Icons.Outlined.ErrorOutline to Dakly.colors.bad
                        else -> Icons.Outlined.Schedule to Dakly.colors.ink3
                    }
                    Icon(icon, m.status, Modifier.size(14.dp), tint = tint)
                }
            }
            if (m.status == "failed" && !m.error.isNullOrBlank()) Text(m.error, color = Dakly.colors.bad, fontSize = 11.sp)
        }
    }
}
