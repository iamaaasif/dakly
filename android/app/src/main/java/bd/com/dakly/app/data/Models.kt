package bd.com.dakly.app.data

import kotlinx.serialization.Serializable

// Models for the Dakly /api/v1 API (see API.md in the backend). Every field has a default so a
// server that adds or omits fields never crashes the app. Money is whole units of `currency`.

@Serializable data class Ok(val ok: Boolean = true, val message: String? = null)
@Serializable data class Created(val id: String = "", val name: String? = null)

// ---------------------------------------------------------------- auth / account

@Serializable data class LoginBody(val email: String, val password: String)
@Serializable data class RegisterBody(
    val name: String, val shop: String, val email: String, val password: String,
    val country: String = "BD", val language: String? = null,
)
@Serializable data class EmailBody(val email: String)
@Serializable data class PasswordBody(val password: String)
@Serializable data class TokenResponse(val token: String = "", val expiresInDays: Int = 60)

@Serializable data class ShopLocale(
    val id: String = "", val name: String = "", val status: String = "active",
    val country: String = "BD", val currency: String = "BDT", val timezone: String = "Asia/Dhaka",
    val language: String = "bn", val brandVoice: String? = null,
)
@Serializable data class User(val id: String = "", val name: String = "", val email: String = "", val uiLang: String? = null)
@Serializable data class Usage(val used: Int = 0, val limit: Int = 0)
@Serializable data class Price(val amount: Long = 0, val currency: String = "BDT")
@Serializable data class Plan(
    val key: String = "", val name: String = "", val until: String? = null, val price: Price? = null,
    val messages: Usage = Usage(), val ai: Usage = Usage(),
)
@Serializable data class Channels(
    val whatsapp: Boolean = false, val sms: String? = null, val voice: Boolean = false,
    val facebookPage: String? = null, val store: String? = null,
)
@Serializable data class Me(val user: User = User(), val shop: ShopLocale = ShopLocale(), val plan: Plan? = null, val channels: Channels = Channels())
@Serializable data class MePatch(val name: String? = null, val uiLang: String? = null)
@Serializable data class ShopStatus(val status: String = "active", val reason: String? = null)

// ---------------------------------------------------------------- dashboard / insights

@Serializable data class Kpi(
    val sales30: Long = 0, val salesPrev30: Long = 0, val orders30: Int = 0, val avgOrder: Long = 0,
    val repeatShare: Double = 0.0, val returnedThisMonth: Int = 0, val repeatSalesThisMonth: Long = 0,
    val customers: Int = 0, val active: Int = 0, val campaignRevenue: Long = 0,
)
@Serializable data class Week(val start: String = "", val fresh: Long = 0, val repeat: Long = 0)
@Serializable data class Segments(val vip: Int = 0, val regular: Int = 0, val new: Int = 0, val inactive: Int = 0, val all: Int = 0)
@Serializable data class CampaignResult(
    val id: String = "", val name: String = "", val sentAt: String? = null, val recipients: Int = 0,
    val read: Int = 0, val buyers: Int = 0, val revenue: Long = 0,
)
@Serializable data class Tip(
    val title: String = "", val body: String = "", val segment: String? = null, val offer: String? = null,
    val why: String? = null, val campaignHref: String? = null,
)
@Serializable data class Tips(val tips: List<Tip> = emptyList(), val source: String = "rules")
@Serializable data class Action(val label: String = "", val href: String = "")
@Serializable data class Notice(
    val key: String = "", val tone: String = "info", val icon: String? = null,
    val title: String = "", val body: String = "", val action: Action? = null,
)
@Serializable data class BestTime(val hour: Int = 20, val label: String = "", val nextAt: String? = null)
@Serializable data class Dashboard(
    val country: String = "BD", val currency: String = "BDT", val timezone: String = "Asia/Dhaka", val language: String = "bn",
    val greeting: String = "", val kpi: Kpi = Kpi(), val weeks: List<Week> = emptyList(), val segments: Segments = Segments(),
    val campaigns: List<CampaignResult> = emptyList(), val aiTips: Tips? = null, val notifications: List<Notice> = emptyList(),
    val bestTime: BestTime? = null, val inboxUnread: Int = 0, val messagesThisMonth: Usage = Usage(),
)
@Serializable data class Insights(val aiTips: Tips? = null, val notifications: List<Notice> = emptyList())
@Serializable data class KeyBody(val key: String)

// ---------------------------------------------------------------- customers

@Serializable data class CustomerStats(val total: Long = 0, val count: Int = 0, val first: String? = null, val last: String? = null)
@Serializable data class CustomerRow(
    val id: String = "", val name: String = "", val phone: String = "", val email: String? = null, val area: String? = null,
    val createdAt: String? = null, val optedOut: Boolean = false, val segment: String = "regular", val stats: CustomerStats = CustomerStats(),
)
@Serializable data class CustomerPage(
    val currency: String = "BDT", val total: Int = 0, val page: Int = 1, val pageSize: Int = 50,
    val hasMore: Boolean = false, val items: List<CustomerRow> = emptyList(),
)
@Serializable data class Order(val id: String = "", val amount: Long = 0, val items: String? = null, val orderedAt: String? = null)
@Serializable data class Recommendation(val product: String = "", val reason: String = "")
@Serializable data class CustomerDetail(
    val id: String = "", val name: String = "", val phone: String = "", val email: String? = null, val area: String? = null,
    val note: String? = null, val source: String? = null, val optedOut: Boolean = false, val createdAt: String? = null,
    val orders: List<Order> = emptyList(), val segment: String = "regular", val total: Long = 0,
    val chatWindowOpen: Boolean = false, val recommendation: Recommendation? = null, val currency: String = "BDT",
)
@Serializable data class NewCustomer(
    val name: String, val phone: String, val items: String? = null, val amount: Long? = null,
    val area: String? = null, val source: String = "manual",
)
@Serializable data class CustomerPatch(
    val name: String? = null, val area: String? = null, val email: String? = null, val note: String? = null, val optedOut: Boolean? = null,
)
@Serializable data class NewOrder(val amount: Long, val items: String? = null)
@Serializable data class CallLog(val how: String, val durationSec: Int? = null, val note: String? = null)
@Serializable data class ImportMapping(
    val name: String? = null, val phone: String? = null, val total: String? = null, val last: String? = null,
    val count: String? = null, val email: String? = null, val area: String? = null,
)
@Serializable data class ImportPreview(
    val rows: Int = 0, val mapping: ImportMapping = ImportMapping(),
    val sample: List<Map<String, kotlinx.serialization.json.JsonElement>> = emptyList(), val invalid: Int = 0,
)
@Serializable data class ImportResult(val created: Int = 0, val updated: Int = 0, val skipped: Int = 0)
@Serializable data class VoiceParsed(val name: String? = null, val phone: String? = null, val items: String? = null, val amount: Long? = null)
@Serializable data class VoiceResult(val text: String = "", val parsed: VoiceParsed = VoiceParsed())

// ---------------------------------------------------------------- campaigns

@Serializable data class ChannelAvailability(val wa: Boolean = false, val sms: Boolean = false, val voice: Boolean = false, val voiceAllowedOnPlan: Boolean = true)
@Serializable data class Audience(
    val counts: Segments = Segments(), val channels: ChannelAvailability = ChannelAvailability(),
    val messagesLeft: Int = 0, val bestTime: BestTime? = null,
)
@Serializable data class AiMessageBody(val segment: String, val offer: String, val channel: String)
@Serializable data class AiText(val text: String = "", val ai: Boolean = true)
@Serializable data class CampaignRow(
    val id: String = "", val name: String = "", val segment: String = "all", val channels: List<String> = emptyList(),
    val status: String = "draft", val sendAt: String? = null, val sentAt: String? = null, val createdAt: String? = null,
    val recipients: Int = 0, val message: String = "",
)
@Serializable data class CampaignList(val items: List<CampaignRow> = emptyList())
@Serializable data class NewCampaign(
    val name: String? = null, val segment: String, val message: String, val channels: List<String>,
    val `when`: String, val sendAt: String? = null,
)
@Serializable data class MsgCustomer(val id: String = "", val name: String = "", val phone: String = "")
@Serializable data class CampaignMessage(
    val id: String = "", val channel: String = "", val status: String = "", val error: String? = null,
    val updatedAt: String? = null, val customer: MsgCustomer? = null,
)
@Serializable data class CampaignSummary(
    val sent: Int = 0, val delivered: Int = 0, val read: Int = 0, val interested: Int = 0,
    val failed: Int = 0, val test: Int = 0, val skipped: Int = 0,
)
@Serializable data class CampaignDetail(
    val id: String = "", val name: String = "", val segment: String = "all", val message: String = "",
    val channels: List<String> = emptyList(), val status: String = "draft", val sendAt: String? = null,
    val sentAt: String? = null, val createdAt: String? = null,
    val messages: List<CampaignMessage> = emptyList(), val summary: CampaignSummary = CampaignSummary(),
)

// ---------------------------------------------------------------- posts

@Serializable data class AiPostBody(val prompt: String, val tone: String)
@Serializable data class PostRow(
    val id: String = "", val text: String = "", val status: String = "draft", val scheduledAt: String? = null,
    val publishedAt: String? = null, val error: String? = null, val prompt: String? = null,
)
@Serializable data class PostList(val items: List<PostRow> = emptyList())
@Serializable data class NewPost(val text: String, val at: String, val prompt: String? = null)

// ---------------------------------------------------------------- knowledge base

@Serializable data class Knowledge(
    val id: String = "", val type: String = "note", val title: String = "", val body: String? = null,
    val price: Long? = null, val active: Boolean = true, val createdAt: String? = null, val updatedAt: String? = null,
)
@Serializable data class KnowledgeList(val currency: String = "BDT", val brandVoice: String? = null, val items: List<Knowledge> = emptyList())
@Serializable data class KnowledgeBody(
    val type: String, val title: String, val body: String? = null, val price: Long? = null, val active: Boolean = true,
)
@Serializable data class ActiveBody(val active: Boolean)

// ---------------------------------------------------------------- inbox

@Serializable data class ChatCustomer(val id: String = "", val name: String = "", val phone: String = "", val optedOut: Boolean = false)
@Serializable data class LastMessage(
    val body: String? = null, val direction: String = "in", val channel: String = "wa", val kind: String = "text",
    val status: String? = null, val at: String? = null,
)
@Serializable data class Conversation(
    val customer: ChatCustomer = ChatCustomer(), val last: LastMessage? = null, val unread: Int = 0,
    val windowOpen: Boolean = false, val windowEndsAt: String? = null,
)
@Serializable data class InboxPage(val conversations: List<Conversation> = emptyList(), val nextCursor: String? = null, val unreadTotal: Int = 0)
@Serializable data class ChatMessage(
    val id: String = "", val direction: String = "out", val channel: String = "wa", val kind: String = "text",
    val body: String? = null, val status: String = "sent", val error: String? = null, val readAt: String? = null,
    val createdAt: String? = null,
)
@Serializable data class Thread(
    val customer: ChatCustomer = ChatCustomer(), val windowOpen: Boolean = false, val windowEndsAt: String? = null,
    val messages: List<ChatMessage> = emptyList(), val nextCursor: String? = null,
)
@Serializable data class SendBody(val text: String, val channel: String? = null)
@Serializable data class SendResult(val id: String = "", val status: String = "sent", val kind: String = "text")

// ---------------------------------------------------------------- settings

@Serializable data class Profile(
    val name: String = "", val country: String = "BD", val currency: String = "BDT",
    val timezone: String = "Asia/Dhaka", val language: String = "bn", val brandVoice: String? = null,
)
@Serializable data class ChannelState(val wa: String = "off", val sms: String = "off", val voice: String = "off")
@Serializable data class ChannelSettings(
    val state: ChannelState = ChannelState(), val smsProvider: String? = null,
    val values: Map<String, String> = emptyMap(), val saved: Map<String, Boolean> = emptyMap(),
)
@Serializable data class StoreInfo(val type: String? = null, val url: String? = null, val syncedAt: String? = null, val error: String? = null)
@Serializable data class FacebookInfo(val connected: Boolean = false, val pageId: String? = null, val pageName: String? = null)
@Serializable data class CountryOption(val code: String = "", val name: String = "", val currency: String = "", val tz: String = "", val lang: String = "en")
@Serializable data class LanguageOption(val code: String = "", val name: String = "")
@Serializable data class SettingsOptions(
    val countries: List<CountryOption> = emptyList(), val languages: List<LanguageOption> = emptyList(),
    val currencies: List<String> = emptyList(),
)
@Serializable data class Settings(
    val profile: Profile = Profile(), val channels: ChannelSettings = ChannelSettings(), val store: StoreInfo = StoreInfo(),
    val facebook: FacebookInfo = FacebookInfo(), val options: SettingsOptions = SettingsOptions(),
)
@Serializable data class StoreBody(val storeType: String, val storeUrl: String, val storeKey: String, val storeSecret: String? = null)
@Serializable data class FbPage(val id: String = "", val name: String = "")
@Serializable data class FacebookState(
    val available: Boolean = false, val connected: Boolean = false, val page: FbPage? = null,
    val pages: List<FbPage> = emptyList(), val connectUrl: String? = null,
)
@Serializable data class PageBody(val pageId: String)

// ---------------------------------------------------------------- billing / support

@Serializable data class BillingPlan(
    val key: String = "", val name: String = "", val price: Price = Price(), val messages: Int = 0, val ai: Int = 0,
    val features: List<String> = emptyList(),
)
@Serializable data class Billing(
    val current: String? = null, val until: String? = null, val plans: List<BillingPlan> = emptyList(),
    val onlinePayments: Boolean = false, val provider: String? = null,
)
@Serializable data class CheckoutBody(val plan: String, val months: Int)
@Serializable data class UrlResponse(val url: String = "")
@Serializable data class TicketMessage(val id: String? = null, val body: String = "", val fromStaff: Boolean = false, val createdAt: String? = null)
@Serializable data class Ticket(val id: String = "", val subject: String = "", val status: String = "open", val messages: List<TicketMessage> = emptyList())
@Serializable data class TicketList(val items: List<Ticket> = emptyList())
@Serializable data class TicketBody(val subject: String, val body: String)
