package bd.com.dakly.app.util

import android.content.Context
import android.icu.text.RelativeDateTimeFormatter
import android.icu.util.ULocale
import androidx.core.os.ConfigurationCompat
import com.google.i18n.phonenumbers.NumberParseException
import com.google.i18n.phonenumbers.PhoneNumberUtil
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Currency
import java.util.Locale

/**
 * Locale-aware formatting. Language follows the app language (English/Bangla), while the
 * country (currency, phone region, time zone) follows the shop's settings, defaulting to Bangladesh.
 */
object Format {
    @Volatile var shopCountry: String = "BD"
    @Volatile var shopCurrency: String = "BDT"
    @Volatile var shopZone: ZoneId = ZoneId.of("Asia/Dhaka")

    fun configure(country: String?, currency: String?, timezone: String?) {
        country?.takeIf { it.length == 2 }?.let { shopCountry = it.uppercase(Locale.ROOT) }
        currency?.takeIf { it.length == 3 }?.let { shopCurrency = it.uppercase(Locale.ROOT) }
        timezone?.let { runCatching { ZoneId.of(it) }.getOrNull() }?.let { shopZone = it }
    }

    fun locale(context: Context): Locale {
        val list = ConfigurationCompat.getLocales(context.resources.configuration)
        val lang = if (list.isEmpty) "en" else list[0]!!.language
        // Bangla UI with Bangladeshi conventions (৳, Bangla digits); English UI keeps Latin digits.
        return Locale(lang, shopCountry)
    }

    fun money(context: Context, amount: Double?, currency: String? = null): String {
        if (amount == null) return "–"
        val code = currency ?: shopCurrency
        val nf = NumberFormat.getCurrencyInstance(locale(context))
        runCatching { nf.currency = Currency.getInstance(code) }
        if (code == "BDT") {
            // Java prints "BDT" in some locales; sellers expect the taka sign.
            val n = NumberFormat.getNumberInstance(locale(context)).apply { maximumFractionDigits = if (amount % 1.0 == 0.0) 0 else 2 }
            return "৳" + n.format(amount)
        }
        nf.maximumFractionDigits = if (amount % 1.0 == 0.0) 0 else 2
        return nf.format(amount)
    }

    fun number(context: Context, n: Number?): String =
        if (n == null) "–" else NumberFormat.getIntegerInstance(locale(context)).format(n)

    fun compact(context: Context, n: Double?): String {
        if (n == null) return "–"
        val nf = NumberFormat.getNumberInstance(locale(context)).apply { maximumFractionDigits = 1 }
        return when {
            n >= 1_000_000 -> nf.format(n / 1_000_000) + "M"
            n >= 10_000 -> nf.format(n / 1_000) + "K"
            else -> nf.format(n)
        }
    }

    fun parseInstant(iso: String?): Instant? = iso?.let {
        runCatching { Instant.parse(it) }.getOrNull()
            ?: runCatching { ZonedDateTime.parse(it).toInstant() }.getOrNull()
            ?: runCatching { LocalDateTime.parse(it).atZone(shopZone).toInstant() }.getOrNull()
    }

    fun dateTime(context: Context, iso: String?): String {
        val i = parseInstant(iso) ?: return "–"
        return DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)
            .withLocale(locale(context)).withDecimalStyle(java.time.format.DecimalStyle.of(locale(context))).format(i.atZone(shopZone))
    }

    fun date(context: Context, iso: String?): String {
        val i = parseInstant(iso) ?: return "–"
        return DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(locale(context)).withDecimalStyle(java.time.format.DecimalStyle.of(locale(context))).format(i.atZone(shopZone))
    }

    /** "3 days ago", "in 2 hours", in the app language (not the phone's), with the shop's digits. */
    fun relative(context: Context, iso: String?, narrow: Boolean = false): String {
        val i = parseInstant(iso) ?: return "–"
        val diff = System.currentTimeMillis() - i.toEpochMilli()
        val dir = if (diff >= 0) RelativeDateTimeFormatter.Direction.LAST else RelativeDateTimeFormatter.Direction.NEXT
        val a = kotlin.math.abs(diff)
        val f = RelativeDateTimeFormatter.getInstance(
            ULocale.forLocale(locale(context)), null,
            if (narrow) RelativeDateTimeFormatter.Style.NARROW else RelativeDateTimeFormatter.Style.LONG,
            android.icu.text.DisplayContext.CAPITALIZATION_FOR_BEGINNING_OF_SENTENCE,
        )
        val min = 60_000L; val hour = 60 * min; val day = 24 * hour
        return when {
            a < min -> f.format(RelativeDateTimeFormatter.Direction.PLAIN, RelativeDateTimeFormatter.AbsoluteUnit.NOW)
            a < hour -> f.format((a / min).toDouble(), dir, RelativeDateTimeFormatter.RelativeUnit.MINUTES)
            a < day -> f.format((a / hour).toDouble(), dir, RelativeDateTimeFormatter.RelativeUnit.HOURS)
            a < 7 * day -> f.format((a / day).toDouble(), dir, RelativeDateTimeFormatter.RelativeUnit.DAYS)
            a < 30 * day -> f.format((a / (7 * day)).toDouble(), dir, RelativeDateTimeFormatter.RelativeUnit.WEEKS)
            a < 365 * day -> f.format((a / (30 * day)).toDouble(), dir, RelativeDateTimeFormatter.RelativeUnit.MONTHS)
            else -> f.format((a / (365 * day)).toDouble(), dir, RelativeDateTimeFormatter.RelativeUnit.YEARS)
        }
    }

    /** Material DatePicker works in UTC midnights: the shop's calendar day for [at] (or today) as that value. */
    fun pickerDay(at: Instant? = null): Long =
        (at?.atZone(shopZone)?.toLocalDate() ?: java.time.LocalDate.now(shopZone))
            .atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli()

    fun time(context: Context, iso: String?): String {
        val i = parseInstant(iso) ?: return ""
        return DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT).withLocale(locale(context)).withDecimalStyle(java.time.format.DecimalStyle.of(locale(context))).format(i.atZone(shopZone))
    }

    private val phones by lazy { PhoneNumberUtil.getInstance() }

    /** Pretty national format for display, e.g. 01711-234567 (BD) or +44 7700 900123 (foreign). */
    fun phone(raw: String?): String {
        if (raw.isNullOrBlank()) return ""
        return try {
            val p = phones.parse(raw, shopCountry)
            val sameRegion = phones.getRegionCodeForNumber(p) == shopCountry
            phones.format(p, if (sameRegion) PhoneNumberUtil.PhoneNumberFormat.NATIONAL else PhoneNumberUtil.PhoneNumberFormat.INTERNATIONAL)
        } catch (e: NumberParseException) {
            raw
        }
    }

    /** E.164 without "+", as wa.me expects (8801711234567). Null when not a valid number. */
    fun e164Digits(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        return try {
            val p = phones.parse(raw, shopCountry)
            if (!phones.isPossibleNumber(p)) null
            else phones.format(p, PhoneNumberUtil.PhoneNumberFormat.E164).removePrefix("+")
        } catch (e: NumberParseException) {
            null
        }
    }

    fun isValidPhone(raw: String?): Boolean = e164Digits(raw) != null

    /** First letter for avatars, works for Bangla names (keeps combining marks out). */
    fun initial(name: String?): String {
        val n = name?.trim().orEmpty()
        if (n.isEmpty()) return "?"
        val it = java.text.BreakIterator.getCharacterInstance()
        it.setText(n)
        val end = it.next()
        return n.substring(0, if (end > 0) end else 1).uppercase()
    }
}
