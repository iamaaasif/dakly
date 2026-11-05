package bd.com.dakly.app.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.RadioButtonUnchecked
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.UploadFile
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import bd.com.dakly.app.R
import bd.com.dakly.app.data.Dashboard
import bd.com.dakly.app.data.Tip
import bd.com.dakly.app.ui.LocalRepo
import bd.com.dakly.app.ui.Routes
import bd.com.dakly.app.ui.components.Avatar
import bd.com.dakly.app.ui.components.ContentPadding
import bd.com.dakly.app.ui.components.DCard
import bd.com.dakly.app.ui.components.LoadContent
import bd.com.dakly.app.ui.components.Load
import bd.com.dakly.app.ui.components.SectionTitle
import bd.com.dakly.app.ui.components.StatTile
import bd.com.dakly.app.ui.components.UsageBar
import bd.com.dakly.app.ui.components.segmentColors
import bd.com.dakly.app.ui.openTab
import bd.com.dakly.app.ui.rememberLoad
import bd.com.dakly.app.ui.segmentLabel
import bd.com.dakly.app.ui.theme.Dakly
import bd.com.dakly.app.util.Format

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(nav: NavHostController) {
    val repo = LocalRepo.current
    val me by repo.me.collectAsState()
    val data = rememberLoad { repo.dashboard().also { runCatching { repo.loadMe() } } }
    val ctx = LocalContext.current

    Column(Modifier.fillMaxWidth()) {
        // Header: shop, notifications
        Row(
            Modifier.fillMaxWidth().background(Dakly.colors.paper).statusBarsPadding()
                .padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Avatar(me?.shop?.name, 38.dp, Dakly.colors.haldiSoft, Dakly.colors.haldi)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(me?.shop?.name.orEmpty(), style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                val customers = (data.value as? Load.Ready)?.data?.kpi?.customers
                if (customers != null) Text(stringResource(R.string.home_customers_count, Format.number(ctx, customers)), color = Dakly.colors.ink3, fontSize = 12.5.sp)
            }
            val alerts = (data.value as? Load.Ready)?.data?.notifications?.size ?: 0
            IconButton(onClick = { nav.navigate(Routes.ALERTS) }) {
                BadgedBox(badge = { if (alerts > 0) Badge(containerColor = Dakly.colors.dak) { Text("$alerts") } }) {
                    Icon(Icons.Outlined.Notifications, stringResource(R.string.alerts_title))
                }
            }
        }

        LoadContent(data.value, onRetry = data::reload) { d ->
            PullToRefreshBox(isRefreshing = (data.value as? Load.Ready)?.refreshing == true, onRefresh = data::reload) {
                HomeContent(nav, d, me?.onboarding)
            }
        }
    }
}

@Composable
private fun HomeContent(nav: NavHostController, d: Dashboard, onboarding: bd.com.dakly.app.data.Onboarding? = null) {
    val ctx = LocalContext.current
    LazyColumn(contentPadding = ContentPadding, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Column {
                Text(d.greeting.ifBlank { stringResource(R.string.home_hello) }, style = MaterialTheme.typography.headlineMedium)
                val tips = d.aiTips?.tips?.size ?: 0
                if (tips > 0) Text(stringResource(R.string.home_opportunities, Format.number(ctx, tips)), color = Dakly.colors.ink2)
            }
        }

        if (onboarding != null && !onboarding.done && onboarding.steps.isNotEmpty()) item { OnboardingCard(nav, onboarding) }

        d.aiTips?.tips?.firstOrNull()?.let { tip -> item { TipHero(tip, onAct = { nav.navigate(Routes.newCampaign(tip.segment, tip.offer)) }, onLater = { nav.navigate(Routes.ALERTS) }) } }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatTile(Format.number(ctx, d.kpi.returnedThisMonth), stringResource(R.string.kpi_returned), Modifier.weight(1f))
                StatTile(Format.money(ctx, d.kpi.repeatSalesThisMonth.toDouble(), d.currency), stringResource(R.string.kpi_repeat_sales), Modifier.weight(1f))
                StatTile(Format.number(ctx, d.kpi.customers), stringResource(R.string.kpi_customers), Modifier.weight(1f))
            }
        }

        item { SalesCard(d) }

        if (d.inboxUnread > 0) item {
            DCard(onClick = { nav.openTab(Routes.INBOX) }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconBubble(Icons.Outlined.ChatBubbleOutline, Dakly.colors.leaf, Dakly.colors.leafSoft)
                    Spacer(Modifier.width(12.dp))
                    Text(stringResource(R.string.home_unread_messages, Format.number(ctx, d.inboxUnread)), Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                    Text(stringResource(R.string.open), color = Dakly.colors.dak, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        item { SectionTitle(stringResource(R.string.home_segments), action = stringResource(R.string.see_all), onAction = { nav.openTab(Routes.CUSTOMERS) }) }
        item {
            val segs = listOf("vip" to d.segments.vip, "regular" to d.segments.regular, "new" to d.segments.new, "inactive" to d.segments.inactive)
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                segs.chunked(2).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        row.forEach { (k, n) ->
                            val (fg, bg) = segmentColors(k)
                            DCard(Modifier.weight(1f), onClick = { nav.navigate(Routes.newCampaign(k)) }, padding = 12.dp) {
                                Column {
                                    Box(Modifier.size(10.dp).clip(CircleShape).background(fg))
                                    Spacer(Modifier.height(6.dp))
                                    Text(Format.number(ctx, n), style = MaterialTheme.typography.headlineSmall)
                                    Text(stringResource(segmentLabel(k)), color = Dakly.colors.ink2, fontSize = 13.sp)
                                    Text(stringResource(R.string.home_send_offer), color = fg, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier.padding(top = 4.dp).clip(RoundedCornerShape(6.dp)).background(bg).padding(horizontal = 6.dp, vertical = 1.dp))
                                }
                            }
                        }
                    }
                }
            }
        }

        item { SectionTitle(stringResource(R.string.home_quick_actions)) }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    QuickAction(Icons.Outlined.PersonAdd, stringResource(R.string.qa_add_customer), Modifier.weight(1f)) { nav.navigate(Routes.newCustomer()) }
                    QuickAction(Icons.Outlined.Mic, stringResource(R.string.qa_voice), Modifier.weight(1f)) { nav.navigate(Routes.newCustomer(voice = true)) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    QuickAction(Icons.Outlined.UploadFile, stringResource(R.string.qa_import), Modifier.weight(1f)) { nav.navigate(Routes.IMPORT) }
                    QuickAction(Icons.Outlined.Edit, stringResource(R.string.qa_ai_post), Modifier.weight(1f)) { nav.navigate(Routes.POSTS) }
                }
            }
        }

        if (d.campaigns.isNotEmpty()) {
            item { SectionTitle(stringResource(R.string.home_campaign_results), action = stringResource(R.string.see_all), onAction = { nav.openTab(Routes.CAMPAIGNS) }) }
            d.campaigns.take(3).forEach { c ->
                item(key = "c" + c.id) {
                    DCard(onClick = { nav.navigate(Routes.campaign(c.id)) }) {
                        Column {
                            Text(c.name, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Spacer(Modifier.height(6.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                MiniStat(Format.number(ctx, c.recipients), stringResource(R.string.cs_sent))
                                MiniStat(Format.number(ctx, c.read), stringResource(R.string.cs_read))
                                MiniStat(Format.number(ctx, c.buyers), stringResource(R.string.cs_buyers))
                                MiniStat(Format.money(ctx, c.revenue.toDouble(), d.currency), stringResource(R.string.cs_revenue))
                            }
                        }
                    }
                }
            }
        }

        item {
            DCard {
                Column {
                    Row {
                        Text(stringResource(R.string.home_messages_month), Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                        Text("${Format.number(ctx, d.messagesThisMonth.used)} / ${Format.number(ctx, d.messagesThisMonth.limit)}", color = Dakly.colors.ink2)
                    }
                    Spacer(Modifier.height(8.dp))
                    UsageBar(d.messagesThisMonth.used, d.messagesThisMonth.limit)
                    d.bestTime?.label?.takeIf { it.isNotBlank() }?.let {
                        Spacer(Modifier.height(8.dp))
                        Text(stringResource(R.string.home_best_time, it), color = Dakly.colors.ink3, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun TipHero(tip: Tip, onAct: () -> Unit, onLater: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Dakly.colors.hero).padding(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.AutoAwesome, null, tint = Dakly.colors.haldi, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text(stringResource(R.string.home_ai_advice), color = Dakly.colors.haldi, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(8.dp))
        Text(tip.title, color = Dakly.colors.heroFg, style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(6.dp))
        Text(tip.body, color = Dakly.colors.hero2, style = MaterialTheme.typography.bodyMedium)
        tip.why?.takeIf { it.isNotBlank() }?.let {
            Spacer(Modifier.height(4.dp))
            Text(it, color = Dakly.colors.hero2, fontSize = 12.sp)
        }
        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            androidx.compose.material3.Button(
                onClick = onAct, shape = RoundedCornerShape(12.dp), modifier = Modifier.weight(1f, fill = false),
                colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Dakly.colors.dak, contentColor = Dakly.colors.dakInk),
            ) {
                Icon(Icons.Outlined.Campaign, null, Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text(stringResource(R.string.home_create_campaign), maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
            }
            OutlinedButton(onClick = onLater, shape = RoundedCornerShape(12.dp)) {
                Text(stringResource(R.string.home_later), color = Dakly.colors.heroFg, maxLines = 1, softWrap = false)
            }
        }
    }
}

@Composable
private fun SalesCard(d: Dashboard) {
    val ctx = LocalContext.current
    val change = if (d.kpi.salesPrev30 > 0) ((d.kpi.sales30 - d.kpi.salesPrev30) * 100.0 / d.kpi.salesPrev30) else null
    DCard {
        Column {
            Text(stringResource(R.string.home_sales_30), color = Dakly.colors.ink2, fontSize = 13.sp)
            Row(verticalAlignment = Alignment.Bottom) {
                Text(Format.money(ctx, d.kpi.sales30.toDouble(), d.currency), style = MaterialTheme.typography.headlineMedium)
                if (change != null) {
                    Spacer(Modifier.width(8.dp))
                    val up = change >= 0
                    Text(
                        (if (up) "▲ " else "▼ ") + Format.number(ctx, kotlin.math.abs(change).toInt()) + "%",
                        color = if (up) Dakly.colors.leaf else Dakly.colors.dak, fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(bottom = 4.dp),
                    )
                }
            }
            Text(
                stringResource(R.string.home_sales_sub, Format.number(ctx, d.kpi.orders30), Format.money(ctx, d.kpi.avgOrder.toDouble(), d.currency), Format.number(ctx, (d.kpi.repeatShare * if (d.kpi.repeatShare <= 1) 100 else 1).toInt())),
                color = Dakly.colors.ink3, fontSize = 12.5.sp,
            )
            if (d.weeks.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                WeeksChart(d)
                Spacer(Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    LegendDot(Dakly.colors.ink); Text(" " + stringResource(R.string.chart_new), fontSize = 12.sp, color = Dakly.colors.ink2)
                    Spacer(Modifier.width(12.dp))
                    LegendDot(Dakly.colors.dak); Text(" " + stringResource(R.string.chart_repeat), fontSize = 12.sp, color = Dakly.colors.ink2)
                }
            }
        }
    }
}

@Composable
private fun LegendDot(c: androidx.compose.ui.graphics.Color) = Box(Modifier.size(9.dp).clip(CircleShape).background(c))

/** 12 weekly stacked bars: new-customer sales (ink) and repeat sales (dak). */
@Composable
private fun WeeksChart(d: Dashboard) {
    val ink = Dakly.colors.ink
    val dak = Dakly.colors.dak
    val track = Dakly.colors.sunk
    val max = (d.weeks.maxOfOrNull { it.fresh + it.repeat } ?: 0L).coerceAtLeast(1L)
    Canvas(Modifier.fillMaxWidth().height(110.dp)) {
        val n = d.weeks.size
        val gap = 6.dp.toPx()
        val w = (size.width - gap * (n - 1)) / n
        d.weeks.forEachIndexed { i, wk ->
            val x = i * (w + gap)
            val total = (wk.fresh + wk.repeat).toFloat()
            drawRoundRect(track, Offset(x, 0f), Size(w, size.height), CornerRadius(4.dp.toPx()))
            val hTotal = size.height * (total / max)
            val hRepeat = size.height * (wk.repeat.toFloat() / max)
            if (hTotal > 0f) drawRoundRect(ink, Offset(x, size.height - hTotal), Size(w, hTotal), CornerRadius(4.dp.toPx()))
            if (hRepeat > 0f) drawRoundRect(dak, Offset(x, size.height - hRepeat), Size(w, hRepeat), CornerRadius(4.dp.toPx()))
        }
    }
}

@Composable
private fun MiniStat(value: String, label: String) {
    Column {
        Text(value, fontWeight = FontWeight.Bold)
        Text(label, color = Dakly.colors.ink3, fontSize = 11.5.sp)
    }
}

@Composable
fun IconBubble(icon: ImageVector, fg: androidx.compose.ui.graphics.Color, bg: androidx.compose.ui.graphics.Color) {
    Box(Modifier.size(38.dp).clip(RoundedCornerShape(12.dp)).background(bg), contentAlignment = Alignment.Center) {
        Icon(icon, null, tint = fg, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun QuickAction(icon: ImageVector, label: String, modifier: Modifier, onClick: () -> Unit) {
    DCard(modifier, onClick = onClick, padding = 12.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconBubble(icon, Dakly.colors.dak, Dakly.colors.dakSoft)
            Spacer(Modifier.width(10.dp))
            Text(label, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, maxLines = 2)
        }
    }
}

/** First-run checklist from GET /me (customers, knowledge, channel, first campaign...), shown until done. */
@Composable
private fun OnboardingCard(nav: NavHostController, o: bd.com.dakly.app.data.Onboarding) {
    val ctx = LocalContext.current
    DCard {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.onboarding_title), style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                Text(stringResource(R.string.onboarding_progress, Format.number(ctx, o.progress), Format.number(ctx, o.total)), color = Dakly.colors.ink2, fontSize = 13.sp)
            }
            androidx.compose.material3.LinearProgressIndicator(
                progress = { if (o.total > 0) o.progress.toFloat() / o.total else 0f },
                modifier = Modifier.fillMaxWidth(), color = Dakly.colors.leaf, trackColor = Dakly.colors.sunk,
            )
            o.steps.forEach { s ->
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp))
                        .clickable(enabled = !s.done) { nav.navigate(Routes.fromWebPath(s.href)) }
                        .padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        if (s.done) Icons.Outlined.CheckCircle else Icons.Outlined.RadioButtonUnchecked, null,
                        tint = if (s.done) Dakly.colors.leaf else Dakly.colors.ink3, modifier = Modifier.size(22.dp),
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        s.label, Modifier.weight(1f), color = if (s.done) Dakly.colors.ink3 else Dakly.colors.ink,
                        textDecoration = if (s.done) androidx.compose.ui.text.style.TextDecoration.LineThrough else null,
                    )
                    if (!s.required && !s.done) Text(stringResource(R.string.onboarding_optional), color = Dakly.colors.ink3, fontSize = 12.sp)
                }
            }
        }
    }
}
