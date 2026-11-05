package bd.com.dakly.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import bd.com.dakly.app.R
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Dakly colours, aligned with wowapps.io: lime #D6EF67, ink #070707, forest #347421. Same tokens as the web app. */
@Immutable
data class DaklyColors(
    val paper: Color, val surface: Color, val sunk: Color, val line: Color,
    val ink: Color, val ink2: Color, val ink3: Color,
    /** Brand lime: fills only (buttons, selected tab, badges). Never use as text on [paper]. */
    val dak: Color, val dakSoft: Color, val dakInk: Color, val dakEdge: Color,
    /** Readable brand green for text, links, icons and selected borders. */
    val accent: Color, val accentSoft: Color,
    /** Errors and destructive actions. */
    val bad: Color, val badSoft: Color,
    val haldi: Color, val haldiSoft: Color,
    val leaf: Color, val leafSoft: Color,
    val sky: Color, val skySoft: Color,
    val hero: Color, val heroFg: Color, val hero2: Color,
)

val LightDakly = DaklyColors(
    paper = Color(0xFFF9FAF8), surface = Color(0xFFFFFFFF), sunk = Color(0xFFEFF2EC), line = Color(0xFFE1E5DC),
    ink = Color(0xFF070707), ink2 = Color(0xFF2E2E2E), ink3 = Color(0xFF66695F),
    dak = Color(0xFFD6EF67), dakSoft = Color(0xFFEFF9E6), dakInk = Color(0xFF070707), dakEdge = Color(0xFFB6CE4E),
    accent = Color(0xFF347421), accentSoft = Color(0xFFEFF9E6),
    bad = Color(0xFFC4372B), badSoft = Color(0xFFFDECEA),
    haldi = Color(0xFF8A5A00), haldiSoft = Color(0xFFFFF6DC),
    leaf = Color(0xFF347421), leafSoft = Color(0xFFE3F3D3),
    sky = Color(0xFF2F6690), skySoft = Color(0xFFE6EFF6),
    hero = Color(0xFF070707), heroFg = Color(0xFFFDFDFD), hero2 = Color(0xFFA6B198),
)

val DarkDakly = DaklyColors(
    paper = Color(0xFF070707), surface = Color(0xFF121212), sunk = Color(0xFF1C1C1C), line = Color(0xFF2E2E2E),
    ink = Color(0xFFFDFDFD), ink2 = Color(0xFFD2D2D2), ink3 = Color(0xFF9A9D94),
    dak = Color(0xFFD6EF67), dakSoft = Color(0xFF222B10), dakInk = Color(0xFF070707), dakEdge = Color(0xFFB6CE4E),
    accent = Color(0xFFD6EF67), accentSoft = Color(0xFF222B10),
    bad = Color(0xFFFF8D9B), badSoft = Color(0xFF331519),
    haldi = Color(0xFFFFB800), haldiSoft = Color(0xFF2B2208),
    leaf = Color(0xFF9BD878), leafSoft = Color(0xFF18260F),
    sky = Color(0xFF7DB0DA), skySoft = Color(0xFF15222E),
    hero = Color(0xFF141C0D), heroFg = Color(0xFFFDFDFD), hero2 = Color(0xFFA6B198),
)

val LocalDakly = staticCompositionLocalOf { LightDakly }

private fun scheme(c: DaklyColors, dark: Boolean): ColorScheme {
    val base = if (dark) darkColorScheme() else lightColorScheme()
    return base.copy(
        primary = c.dak, onPrimary = c.dakInk, primaryContainer = c.dakSoft, onPrimaryContainer = c.accent,
        secondary = c.accent, onSecondary = c.surface, secondaryContainer = c.leafSoft, onSecondaryContainer = c.leaf,
        tertiary = c.sky, tertiaryContainer = c.skySoft,
        background = c.paper, onBackground = c.ink,
        surface = c.surface, onSurface = c.ink, surfaceVariant = c.sunk, onSurfaceVariant = c.ink2,
        surfaceContainerLowest = c.surface, surfaceContainerLow = c.surface, surfaceContainer = c.surface,
        surfaceContainerHigh = c.surface, surfaceContainerHighest = c.sunk,
        outline = c.line, outlineVariant = c.line,
        error = c.bad, onError = c.surface, errorContainer = c.badSoft, onErrorContainer = c.bad,
    )
}

/**
 * Inter (same family as wowapps.io), bundled as a variable font. Weight axes apply on Android 8+;
 * older phones draw every weight as Regular. Bengali glyphs fall back to the system Bengali font.
 */
@OptIn(ExperimentalTextApi::class)
val Inter = FontFamily(
    listOf(400, 500, 600, 700, 800).map { w ->
        Font(R.font.inter, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w)))
    },
)

private val DaklyType = Typography().let { base ->
    val t = base.copy(
        displayLarge = base.displayLarge.copy(fontFamily = Inter), displayMedium = base.displayMedium.copy(fontFamily = Inter),
        displaySmall = base.displaySmall.copy(fontFamily = Inter), headlineLarge = base.headlineLarge.copy(fontFamily = Inter),
        headlineMedium = base.headlineMedium.copy(fontFamily = Inter), headlineSmall = base.headlineSmall.copy(fontFamily = Inter),
        titleLarge = base.titleLarge.copy(fontFamily = Inter), titleMedium = base.titleMedium.copy(fontFamily = Inter),
        titleSmall = base.titleSmall.copy(fontFamily = Inter), bodyLarge = base.bodyLarge.copy(fontFamily = Inter),
        bodyMedium = base.bodyMedium.copy(fontFamily = Inter), bodySmall = base.bodySmall.copy(fontFamily = Inter),
        labelLarge = base.labelLarge.copy(fontFamily = Inter), labelMedium = base.labelMedium.copy(fontFamily = Inter),
        labelSmall = base.labelSmall.copy(fontFamily = Inter),
    )
    t.copy(
        headlineLarge = t.headlineLarge.copy(fontWeight = FontWeight.ExtraBold, fontSize = 28.sp, lineHeight = 34.sp),
        headlineMedium = t.headlineMedium.copy(fontWeight = FontWeight.ExtraBold, fontSize = 24.sp, lineHeight = 30.sp),
        headlineSmall = t.headlineSmall.copy(fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 26.sp),
        titleLarge = t.titleLarge.copy(fontWeight = FontWeight.Bold, fontSize = 18.sp),
        titleMedium = t.titleMedium.copy(fontWeight = FontWeight.SemiBold, fontSize = 16.sp),
        bodyLarge = t.bodyLarge.copy(fontSize = 15.sp, lineHeight = 23.sp),
        bodyMedium = t.bodyMedium.copy(fontSize = 14.sp, lineHeight = 21.sp),
        labelLarge = t.labelLarge.copy(fontWeight = FontWeight.SemiBold, fontSize = 15.sp),
    )
}

private val DaklyShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(18.dp),
    extraLarge = RoundedCornerShape(24.dp),
)

@Composable
fun DaklyTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val colors = if (dark) DarkDakly else LightDakly
    androidx.compose.runtime.CompositionLocalProvider(LocalDakly provides colors) {
        MaterialTheme(colorScheme = scheme(colors, dark), typography = DaklyType, shapes = DaklyShapes, content = content)
    }
}

object Dakly {
    val colors: DaklyColors @Composable get() = LocalDakly.current
}

val Numeric = TextStyle(fontFeatureSettings = "tnum")
