package bd.com.dakly.app.ui

import android.net.Uri
import androidx.compose.foundation.layout.Box
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.NavigationRailItemDefaults
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material.icons.outlined.People
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import bd.com.dakly.app.R
import bd.com.dakly.app.data.ApiException
import bd.com.dakly.app.ui.screens.AlertsScreen
import bd.com.dakly.app.ui.screens.AuthScreen
import bd.com.dakly.app.ui.screens.BillingScreen
import bd.com.dakly.app.ui.screens.CampaignDetailScreen
import bd.com.dakly.app.ui.screens.CampaignWizardScreen
import bd.com.dakly.app.ui.screens.CampaignsScreen
import bd.com.dakly.app.ui.screens.ChatScreen
import bd.com.dakly.app.ui.screens.CustomerDetailScreen
import bd.com.dakly.app.ui.screens.CustomersScreen
import bd.com.dakly.app.ui.screens.HomeScreen
import bd.com.dakly.app.ui.screens.ImportScreen
import bd.com.dakly.app.ui.screens.InboxScreen
import bd.com.dakly.app.ui.screens.KnowledgeEditScreen
import bd.com.dakly.app.ui.screens.KnowledgeScreen
import bd.com.dakly.app.ui.screens.MoreScreen
import bd.com.dakly.app.ui.screens.NewCustomerScreen
import bd.com.dakly.app.ui.screens.PostsScreen
import bd.com.dakly.app.ui.screens.SettingsScreen
import bd.com.dakly.app.ui.screens.ShopStatusScreen
import bd.com.dakly.app.ui.screens.SupportScreen
import bd.com.dakly.app.ui.theme.Dakly
import kotlinx.coroutines.launch

private enum class Gate { Checking, LoggedOut, Blocked, Ready }

/** Decides between login, "shop pending/suspended" and the main app. */
@Composable
fun DaklyRoot(pendingPath: String?, onPathHandled: () -> Unit) {
    val repo = LocalRepo.current
    var gate by remember { mutableStateOf(Gate.Checking) }
    var blocked by remember { mutableStateOf("pending" to (null as String?)) }
    val scope = rememberCoroutineScope()

    suspend fun check() {
        if (!repo.isLoggedIn()) {
            gate = Gate.LoggedOut
            return
        }
        try {
            runCatching { repo.refresh() }
            val me = repo.loadMe()
            gate = if (me.shop.status == "active") Gate.Ready else {
                val s = runCatching { repo.status() }.getOrNull()
                blocked = (s?.status ?: me.shop.status) to s?.reason
                Gate.Blocked
            }
        } catch (e: ApiException) {
            gate = if (e.status == 401) Gate.LoggedOut else Gate.Ready
        } catch (e: Exception) {
            // Offline at start: open the app anyway, screens show their own retry.
            gate = Gate.Ready
        }
    }

    LaunchedEffect(Unit) { check() }
    LaunchedEffect(Unit) { repo.loggedOut.collect { gate = Gate.LoggedOut } }

    when (gate) {
        Gate.Checking -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Dakly.colors.accent)
        }
        Gate.LoggedOut -> AuthScreen(onSignedIn = { scope.launch { gate = Gate.Checking; check() } })
        Gate.Blocked -> ShopStatusScreen(
            status = blocked.first, reason = blocked.second,
            onRetry = { scope.launch { gate = Gate.Checking; check() } },
            onLogout = { scope.launch { repo.logout(); gate = Gate.LoggedOut } },
        )
        Gate.Ready -> MainApp(pendingPath, onPathHandled, onLoggedOut = { gate = Gate.LoggedOut })
    }
}

object Routes {
    const val HOME = "home"
    const val CUSTOMERS = "customers"
    const val INBOX = "inbox"
    const val CAMPAIGNS = "campaigns"
    const val MORE = "more"
    const val CUSTOMER = "customer/{id}"
    const val NEW_CUSTOMER = "customer-new?voice={voice}"
    const val IMPORT = "import"
    const val CHAT = "chat/{id}"
    const val CAMPAIGN = "campaign/{id}"
    const val NEW_CAMPAIGN = "campaign-new?segment={segment}&offer={offer}"
    const val POSTS = "posts"
    const val KNOWLEDGE = "knowledge"
    const val KNOWLEDGE_EDIT = "knowledge-edit?id={id}&type={type}"
    const val ALERTS = "alerts"
    const val SETTINGS = "settings"
    const val BILLING = "billing"
    const val SUPPORT = "support"

    fun customer(id: String) = "customer/$id"
    fun chat(id: String) = "chat/$id"
    fun campaign(id: String) = "campaign/$id"
    fun newCustomer(voice: Boolean = false) = "customer-new?voice=$voice"
    fun newCampaign(segment: String? = null, offer: String? = null) =
        "campaign-new?segment=${Uri.encode(segment ?: "")}&offer=${Uri.encode(offer ?: "")}"
    fun knowledgeEdit(id: String? = null, type: String? = null) = "knowledge-edit?id=${id ?: ""}&type=${type ?: ""}"

    /** Turns a web path (from notifications, App Links, dakly://) into an app route. */
    fun fromWebPath(path: String): String {
        val uri = Uri.parse(if (path.startsWith("/")) "https://x$path" else path)
        val seg = uri.pathSegments
        return when {
            seg.isEmpty() -> HOME
            seg[0] == "customers" && seg.getOrNull(1) == "new" -> newCustomer()
            seg[0] == "customers" && seg.size >= 2 -> customer(seg[1])
            seg[0] == "customers" -> CUSTOMERS
            seg[0] == "campaigns" && seg.getOrNull(1) == "new" ->
                newCampaign(uri.getQueryParameter("segment"), uri.getQueryParameter("offer"))
            seg[0] == "campaigns" && seg.size >= 2 -> campaign(seg[1])
            seg[0] == "campaigns" -> CAMPAIGNS
            seg[0] == "inbox" && seg.size >= 2 -> chat(seg[1])
            seg[0] == "inbox" -> INBOX
            seg[0] == "posts" -> POSTS
            seg[0] == "alerts" || seg[0] == "notifications" -> ALERTS
            seg[0] == "knowledge" -> KNOWLEDGE
            seg[0] == "settings" -> SETTINGS
            seg[0] == "billing" -> BILLING
            seg[0] == "support" -> SUPPORT
            else -> HOME
        }
    }
}

private data class Tab(val route: String, val label: Int, val icon: ImageVector)

private val tabs = listOf(
    Tab(Routes.HOME, R.string.tab_home, Icons.Outlined.Home),
    Tab(Routes.CUSTOMERS, R.string.tab_customers, Icons.Outlined.People),
    Tab(Routes.INBOX, R.string.tab_inbox, Icons.Outlined.ChatBubbleOutline),
    Tab(Routes.CAMPAIGNS, R.string.tab_campaigns, Icons.Outlined.Campaign),
    Tab(Routes.MORE, R.string.tab_more, Icons.Outlined.Menu),
)

/** Opens a top-level tab the way bottom navigation should: one copy, state kept. */
fun NavHostController.openTab(route: String) = navigate(route) {
    popUpTo(graph.findStartDestination().id) { saveState = true }
    launchSingleTop = true
    restoreState = true
}

@Composable
private fun MainApp(pendingPath: String?, onPathHandled: () -> Unit, onLoggedOut: () -> Unit) {
    val nav = rememberNavController()
    val repo = LocalRepo.current
    val entry by nav.currentBackStackEntryAsState()
    val current = entry?.destination?.route
    val showBar = tabs.any { it.route == current }
    var unread by remember { mutableStateOf(0) }

    LaunchedEffect(current) {
        if (current == Routes.HOME || current == Routes.INBOX) {
            unread = runCatching { repo.inbox(null, true, null).unreadTotal }.getOrDefault(unread)
        }
    }
    LaunchedEffect(pendingPath) {
        if (pendingPath != null) {
            nav.navigate(Routes.fromWebPath(pendingPath)) { launchSingleTop = true }
            onPathHandled()
        }
    }

    // Phones: bottom bar. Tablets and landscape (>= 600dp wide): side rail, and content capped at a readable width.
    val wide = LocalConfiguration.current.screenWidthDp >= 600
    val tabColors = NavigationBarItemDefaults.colors(
        selectedIconColor = Dakly.colors.dakInk, selectedTextColor = Dakly.colors.ink,
        indicatorColor = Dakly.colors.dak,
        unselectedIconColor = Dakly.colors.ink3, unselectedTextColor = Dakly.colors.ink3,
    )
    val tabIcon: @Composable (Tab) -> Unit = { t ->
        if (t.route == Routes.INBOX && unread > 0) {
            BadgedBox(badge = { Badge(containerColor = Dakly.colors.dak, contentColor = Dakly.colors.dakInk) { Text(if (unread > 99) "99+" else "$unread") } }) {
                Icon(t.icon, null)
            }
        } else Icon(t.icon, null)
    }

    Scaffold(
        containerColor = Dakly.colors.paper,
        bottomBar = {
            if (showBar && !wide) {
                NavigationBar(containerColor = Dakly.colors.surface, tonalElevation = 0.dp) {
                    tabs.forEach { t ->
                        NavigationBarItem(
                            selected = current == t.route,
                            onClick = { nav.openTab(t.route) },
                            icon = { tabIcon(t) },
                            label = { Text(stringResource(t.label), maxLines = 1) },
                            colors = tabColors,
                        )
                    }
                }
            }
        },
    ) { pad ->
        Row(Modifier.fillMaxSize().padding(bottom = pad.calculateBottomPadding()).consumeWindowInsets(pad)) {
            if (showBar && wide) {
                NavigationRail(containerColor = Dakly.colors.surface) {
                    Spacer(Modifier.weight(1f))
                    tabs.forEach { t ->
                        NavigationRailItem(
                            selected = current == t.route,
                            onClick = { nav.openTab(t.route) },
                            icon = { tabIcon(t) },
                            label = { Text(stringResource(t.label), maxLines = 1) },
                            colors = NavigationRailItemDefaults.colors(
                                selectedIconColor = Dakly.colors.dakInk, selectedTextColor = Dakly.colors.ink,
                                indicatorColor = Dakly.colors.dak,
                                unselectedIconColor = Dakly.colors.ink3, unselectedTextColor = Dakly.colors.ink3,
                            ),
                        )
                    }
                    Spacer(Modifier.weight(1f))
                }
            }
            Box(Modifier.weight(1f).fillMaxHeight(), contentAlignment = Alignment.TopCenter) {
        NavHost(
            nav, startDestination = Routes.HOME,
            modifier = Modifier.widthIn(max = 840.dp).fillMaxSize(),
            // Short fades between tabs, a small slide for drill-down screens: smooth without feeling slow.
            enterTransition = { fadeIn(tween(200)) + slideInHorizontally(tween(260, easing = FastOutSlowInEasing)) { it / 14 } },
            exitTransition = { fadeOut(tween(120)) },
            popEnterTransition = { fadeIn(tween(200)) },
            popExitTransition = { fadeOut(tween(140)) + slideOutHorizontally(tween(220, easing = FastOutSlowInEasing)) { it / 14 } },
        ) {
            composable(Routes.HOME) { HomeScreen(nav) }
            composable(Routes.CUSTOMERS) { CustomersScreen(nav) }
            composable(Routes.INBOX) { InboxScreen(nav, onUnread = { unread = it }) }
            composable(Routes.CAMPAIGNS) { CampaignsScreen(nav) }
            composable(Routes.MORE) { MoreScreen(nav, onLoggedOut) }
            composable(Routes.CUSTOMER, listOf(navArgument("id") { type = NavType.StringType })) {
                CustomerDetailScreen(nav, it.arguments?.getString("id").orEmpty())
            }
            composable(Routes.NEW_CUSTOMER, listOf(navArgument("voice") { type = NavType.BoolType; defaultValue = false })) {
                NewCustomerScreen(nav, startWithVoice = it.arguments?.getBoolean("voice") ?: false)
            }
            composable(Routes.IMPORT) { ImportScreen(nav) }
            composable(Routes.CHAT, listOf(navArgument("id") { type = NavType.StringType })) {
                ChatScreen(nav, it.arguments?.getString("id").orEmpty())
            }
            composable(Routes.CAMPAIGN, listOf(navArgument("id") { type = NavType.StringType })) {
                CampaignDetailScreen(nav, it.arguments?.getString("id").orEmpty())
            }
            composable(
                Routes.NEW_CAMPAIGN,
                listOf(
                    navArgument("segment") { type = NavType.StringType; defaultValue = "" },
                    navArgument("offer") { type = NavType.StringType; defaultValue = "" },
                ),
            ) {
                CampaignWizardScreen(
                    nav,
                    initialSegment = it.arguments?.getString("segment").orEmpty().ifBlank { null },
                    initialOffer = it.arguments?.getString("offer").orEmpty(),
                )
            }
            composable(Routes.POSTS) { PostsScreen(nav) }
            composable(Routes.KNOWLEDGE) { KnowledgeScreen(nav) }
            composable(
                Routes.KNOWLEDGE_EDIT,
                listOf(
                    navArgument("id") { type = NavType.StringType; defaultValue = "" },
                    navArgument("type") { type = NavType.StringType; defaultValue = "" },
                ),
            ) {
                KnowledgeEditScreen(nav, it.arguments?.getString("id").orEmpty().ifBlank { null }, it.arguments?.getString("type").orEmpty().ifBlank { null })
            }
            composable(Routes.ALERTS) { AlertsScreen(nav) }
            composable(Routes.SETTINGS) { SettingsScreen(nav, onLoggedOut) }
            composable(Routes.BILLING) { BillingScreen(nav) }
            composable(Routes.SUPPORT) { SupportScreen(nav) }
        }
            }
        }
    }
}
