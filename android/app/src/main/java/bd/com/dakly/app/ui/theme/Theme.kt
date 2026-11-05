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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Dakly brand colours, same tokens as the web app. */
@Immutable
data class DaklyColors(
    val paper: Color, val surface: Color, val sunk: Color, val line: Color,
    val ink: Color, val ink2: Color, val ink3: Color,
    val dak: Color, val dakSoft: Color, val dakInk: Color,
    val haldi: Color, val haldiSoft: Color,
    val leaf: Color, val leafSoft: Color,
    val sky: Color, val skySoft: Color,
    val hero: Color, val heroFg: Color, val hero2: Color,
)

val LightDakly = DaklyColors(
    paper = Color(0xFFF3F5F2), surface = Color(0xFFFFFFFF), sunk = Color(0xFFE8ECE7), line = Color(0xFFD5DCD4),
    ink = Color(0xFF13261D), ink2 = Color(0xFF4B5D53), ink3 = Color(0xFF6F8076),
    dak = Color(0xFFC8402A), dakSoft = Color(0xFFF8E3DD), dakInk = Color(0xFFFFFFFF),
    haldi = Color(0xFFB07812), haldiSoft = Color(0xFFF7ECD4),
    leaf = Color(0xFF1F7A52), leafSoft = Color(0xFFDCEFE4),
    sky = Color(0xFF2F6690), skySoft = Color(0xFFDDE9F2),
    hero = Color(0xFF13261D), heroFg = Color(0xFFEEF3EE), hero2 = Color(0xFFA9BDB0),
)

val DarkDakly = DaklyColors(
    paper = Color(0xFF0F1713), surface = Color(0xFF16211B), sunk = Color(0xFF1D2A23), line = Color(0xFF2B3A32),
    ink = Color(0xFFE6EEE8), ink2 = Color(0xFFA8B8AE), ink3 = Color(0xFF8B9C91),
    dak = Color(0xFFE8664E), dakSoft = Color(0xFF3A1F19), dakInk = Color(0xFF1A0D09),
    haldi = Color(0xFFE6B04F), haldiSoft = Color(0xFF33291A),
    leaf = Color(0xFF4CBF8A), leafSoft = Color(0xFF173328),
    sky = Color(0xFF6FA6D4), skySoft = Color(0xFF18293A),
    hero = Color(0xFF1F3A2C), heroFg = Color(0xFFEEF3EE), hero2 = Color(0xFFA9C2B3),
)

val LocalDakly = staticCompositionLocalOf { LightDakly }

private fun scheme(c: DaklyColors, dark: Boolean): ColorScheme {
    val base = if (dark) darkColorScheme() else lightColorScheme()
    return base.copy(
        primary = c.dak, onPrimary = c.dakInk, primaryContainer = c.dakSoft, onPrimaryContainer = c.dak,
        secondary = c.leaf, onSecondary = c.surface, secondaryContainer = c.leafSoft, onSecondaryContainer = c.leaf,
        tertiary = c.sky, tertiaryContainer = c.skySoft,
        background = c.paper, onBackground = c.ink,
        surface = c.surface, onSurface = c.ink, surfaceVariant = c.sunk, onSurfaceVariant = c.ink2,
        surfaceContainerLowest = c.surface, surfaceContainerLow = c.surface, surfaceContainer = c.surface,
        surfaceContainerHigh = c.surface, surfaceContainerHighest = c.sunk,
        outline = c.line, outlineVariant = c.line,
        error = c.dak, onError = c.dakInk, errorContainer = c.dakSoft, onErrorContainer = c.dak,
    )
}

private val DaklyType = Typography().let { t ->
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
