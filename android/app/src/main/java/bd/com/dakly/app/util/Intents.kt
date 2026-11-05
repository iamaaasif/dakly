package bd.com.dakly.app.util

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import bd.com.dakly.app.R

/** Direct contact with a customer from the merchant's own phone: call, WhatsApp chat, SMS. */
object Contact {
    fun call(context: Context, phone: String?) {
        val p = phone?.filter { it.isDigit() || it == '+' } ?: return
        start(context, Intent(Intent.ACTION_DIAL, Uri.parse("tel:$p")))
    }

    /**
     * Opens a WhatsApp chat with the customer (WhatsApp or WhatsApp Business, whichever is installed),
     * with an optional pre-filled message. Voice/video calls are one tap from that chat.
     */
    fun whatsapp(context: Context, phone: String?, text: String? = null) {
        val digits = Format.e164Digits(phone)
        if (digits == null) {
            toast(context, R.string.err_invalid_phone)
            return
        }
        val uri = Uri.parse("https://wa.me/$digits" + (if (text.isNullOrBlank()) "" else "?text=" + Uri.encode(text)))
        val pm = context.packageManager
        for (pkg in listOf("com.whatsapp.w4b", "com.whatsapp")) {
            val i = Intent(Intent.ACTION_VIEW, uri).setPackage(pkg)
            if (i.resolveActivity(pm) != null) {
                start(context, i)
                return
            }
        }
        start(context, Intent(Intent.ACTION_VIEW, uri))
    }

    fun sms(context: Context, phone: String?, text: String? = null) {
        val p = phone?.filter { it.isDigit() || it == '+' } ?: return
        val i = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:$p"))
        if (!text.isNullOrBlank()) i.putExtra("sms_body", text)
        start(context, i)
    }

    fun start(context: Context, intent: Intent) {
        try {
            context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: ActivityNotFoundException) {
            toast(context, R.string.err_no_app)
        }
    }

    fun toast(context: Context, res: Int) = Toast.makeText(context, res, Toast.LENGTH_LONG).show()
}

/** Opens a web page in a Chrome Custom Tab (used for Facebook connect, privacy policy, help). */
object Web {
    fun open(context: Context, url: String, toolbarColor: Int = 0xFF13261D.toInt()) {
        val params = CustomTabColorSchemeParams.Builder().setToolbarColor(toolbarColor).build()
        val tab = CustomTabsIntent.Builder().setDefaultColorSchemeParams(params).setShowTitle(true).build()
        try {
            tab.launchUrl(context, Uri.parse(url))
        } catch (e: ActivityNotFoundException) {
            Contact.start(context, Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }
    }
}
