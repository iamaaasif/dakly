package bd.com.dakly.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import bd.com.dakly.app.R
import bd.com.dakly.app.data.OfflineException
import bd.com.dakly.app.ui.theme.Dakly
import bd.com.dakly.app.util.Format

/** Generic async state for a screen. */
sealed interface Load<out T> {
    data object Loading : Load<Nothing>
    data class Ready<T>(val data: T, val refreshing: Boolean = false) : Load<T>
    data class Failed(val error: Throwable) : Load<Nothing>
}

@Composable
fun errorText(e: Throwable): String = when (e) {
    is OfflineException -> stringResource(R.string.offline_body)
    else -> e.message?.takeIf { it.isNotBlank() } ?: stringResource(R.string.error_body)
}

@Composable
fun <T> LoadContent(state: Load<T>, onRetry: () -> Unit, content: @Composable (T) -> Unit) {
    when (state) {
        is Load.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Dakly.colors.accent)
        }
        is Load.Failed -> ErrorState(state.error, onRetry)
        is Load.Ready -> content(state.data)
    }
}

@Composable
fun ErrorState(error: Throwable, onRetry: () -> Unit) {
    val offline = error is OfflineException
    Column(
        Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(if (offline) Icons.Outlined.CloudOff else Icons.Outlined.ErrorOutline, null, Modifier.size(48.dp), tint = Dakly.colors.ink3)
        Spacer(Modifier.height(16.dp))
        Text(
            stringResource(if (offline) R.string.offline_title else R.string.error_title),
            style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(6.dp))
        Text(errorText(error), color = Dakly.colors.ink2, textAlign = TextAlign.Center)
        Spacer(Modifier.height(20.dp))
        PrimaryButton(stringResource(R.string.retry), onClick = onRetry)
    }
}

@Composable
fun EmptyState(icon: ImageVector, title: String, body: String? = null, action: String? = null, onAction: () -> Unit = {}) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(Modifier.size(64.dp).clip(CircleShape).background(Dakly.colors.dakSoft), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = Dakly.colors.accent, modifier = Modifier.size(30.dp))
        }
        Spacer(Modifier.height(14.dp))
        Text(title, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
        if (body != null) {
            Spacer(Modifier.height(4.dp))
            Text(body, color = Dakly.colors.ink2, textAlign = TextAlign.Center, style = MaterialTheme.typography.bodyMedium)
        }
        if (action != null) {
            Spacer(Modifier.height(16.dp))
            PrimaryButton(action, onClick = onAction)
        }
    }
}

@Composable
fun PrimaryButton(
    text: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    icon: ImageVector? = null,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier.heightIn(min = 50.dp),
        shape = CircleShape,
        colors = ButtonDefaults.buttonColors(
            containerColor = Dakly.colors.dak, contentColor = Dakly.colors.dakInk,
            disabledContainerColor = Dakly.colors.sunk, disabledContentColor = Dakly.colors.ink3,
        ),
        border = if (enabled && !loading) androidx.compose.foundation.BorderStroke(1.dp, Dakly.colors.dakEdge) else null,
        contentPadding = PaddingValues(horizontal = 22.dp),
    ) {
        if (loading) {
            CircularProgressIndicator(Modifier.size(20.dp), color = Dakly.colors.dakInk, strokeWidth = 2.dp)
        } else {
            if (icon != null) {
                Icon(icon, null, Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
            }
            Text(text, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
fun SecondaryButton(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, icon: ImageVector? = null, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick, enabled = enabled, modifier = modifier.heightIn(min = 50.dp), shape = CircleShape,
        border = androidx.compose.foundation.BorderStroke(1.dp, Dakly.colors.line),
        contentPadding = PaddingValues(horizontal = 20.dp),
    ) {
        if (icon != null) {
            Icon(icon, null, Modifier.size(18.dp), tint = Dakly.colors.ink)
            Spacer(Modifier.width(8.dp))
        }
        Text(text, color = Dakly.colors.ink)
    }
}

/** White card with a hairline border, the basic block of every screen. */
@Composable
fun DCard(modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, padding: Dp = 16.dp, content: @Composable () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .border(1.dp, Dakly.colors.line, shape),
        color = Dakly.colors.surface,
        shape = shape,
    ) {
        Box(Modifier.padding(padding)) { content() }
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier, action: String? = null, onAction: () -> Unit = {}) {
    Row(modifier.fillMaxWidth().padding(top = 8.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(text, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
        if (action != null) {
            Text(
                action, color = Dakly.colors.accent, fontWeight = FontWeight.SemiBold, fontSize = 14.sp,
                modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(onClick = onAction).padding(horizontal = 8.dp, vertical = 10.dp),
            )
        }
    }
}

@Composable
fun Avatar(name: String?, size: Dp = 40.dp, bg: Color = Dakly.colors.dakSoft, fg: Color = Dakly.colors.accent) {
    Box(Modifier.size(size).clip(CircleShape).background(bg), contentAlignment = Alignment.Center) {
        Text(Format.initial(name), color = fg, fontWeight = FontWeight.Bold, fontSize = (size.value * 0.4f).sp)
    }
}

/** Coloured pill for segments and statuses. */
@Composable
fun Pill(text: String, fg: Color, bg: Color, modifier: Modifier = Modifier) {
    Text(
        text, color = fg, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1,
        modifier = modifier.clip(RoundedCornerShape(50)).background(bg).padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

@Composable
fun StatTile(value: String, label: String, modifier: Modifier = Modifier, accent: Color = Dakly.colors.ink) {
    DCard(modifier, padding = 12.dp) {
        Column {
            Text(value, style = MaterialTheme.typography.titleLarge, color = accent, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(label, color = Dakly.colors.ink3, fontSize = 12.sp, lineHeight = 15.sp, maxLines = 2)
        }
    }
}

@Composable
fun UsageBar(used: Int, limit: Int, modifier: Modifier = Modifier) {
    val f = if (limit <= 0) 0f else (used.toFloat() / limit).coerceIn(0f, 1f)
    LinearProgressIndicator(
        progress = { f },
        modifier = modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
        color = if (f > 0.9f) Dakly.colors.bad else Dakly.colors.leaf,
        trackColor = Dakly.colors.sunk,
    )
}

@Composable
fun Banner(text: String, fg: Color = Dakly.colors.bad, bg: Color = Dakly.colors.badSoft, action: String? = null, modifier: Modifier = Modifier, onAction: () -> Unit = {}) {
    Column(
        modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(bg).padding(14.dp),
    ) {
        Text(text, color = fg, style = MaterialTheme.typography.bodyMedium)
        if (action != null) {
            Text(
                action, color = fg, fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 6.dp).clickable(onClick = onAction),
            )
        }
    }
}

/**
 * Standard screen frame: top bar (with back arrow when [onBack] is set), optional actions and FAB.
 * The outer app Scaffold already handles the bottom insets.
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun ScreenFrame(
    title: String,
    subtitle: String? = null,
    onBack: (() -> Unit)? = null,
    actions: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit = {},
    fab: @Composable () -> Unit = {},
    content: @Composable (PaddingValues) -> Unit,
) {
    androidx.compose.material3.Scaffold(
        containerColor = Dakly.colors.paper,
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0, 0, 0, 0),
        topBar = {
            androidx.compose.material3.TopAppBar(
                title = {
                    Column {
                        Text(title, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        if (subtitle != null) Text(subtitle, color = Dakly.colors.ink3, fontSize = 12.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                },
                navigationIcon = {
                    if (onBack != null) {
                        androidx.compose.material3.IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back))
                        }
                    }
                },
                actions = actions,
                colors = androidx.compose.material3.TopAppBarDefaults.topAppBarColors(
                    containerColor = Dakly.colors.paper, scrolledContainerColor = Dakly.colors.paper,
                    titleContentColor = Dakly.colors.ink,
                ),
            )
        },
        floatingActionButton = fab,
    ) { inner -> content(inner) }
}

/** Standard padding for scrolling screen content. */
val ContentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 96.dp)

fun PaddingValues.plus(other: PaddingValues): PaddingValues = PaddingValues(
    start = other.calculateLeftPadding(androidx.compose.ui.unit.LayoutDirection.Ltr),
    end = other.calculateRightPadding(androidx.compose.ui.unit.LayoutDirection.Ltr),
    top = calculateTopPadding() + other.calculateTopPadding(),
    bottom = calculateBottomPadding() + other.calculateBottomPadding(),
)

@Composable
fun DFab(text: String, icon: ImageVector, onClick: () -> Unit) {
    androidx.compose.material3.ExtendedFloatingActionButton(
        onClick = onClick,
        containerColor = Dakly.colors.dak, contentColor = Dakly.colors.dakInk,
        icon = { Icon(icon, null) }, text = { Text(text, fontWeight = FontWeight.SemiBold) },
    )
}

/** Outlined text field in Dakly style. */
@Composable
fun Field(
    value: String,
    onChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    hint: String? = null,
    singleLine: Boolean = true,
    minLines: Int = 1,
    keyboard: androidx.compose.foundation.text.KeyboardOptions = androidx.compose.foundation.text.KeyboardOptions.Default,
    password: Boolean = false,
    error: String? = null,
    supporting: String? = null,
) {
    androidx.compose.material3.OutlinedTextField(
        value = value, onValueChange = onChange,
        label = { Text(label) },
        placeholder = hint?.let { { Text(it, color = Dakly.colors.ink3) } },
        modifier = modifier.fillMaxWidth(),
        singleLine = singleLine, minLines = minLines,
        keyboardOptions = keyboard,
        visualTransformation = if (password) androidx.compose.ui.text.input.PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        isError = error != null,
        supportingText = (error ?: supporting)?.let { { Text(it) } },
        shape = MaterialTheme.shapes.medium,
        colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Dakly.colors.ink, unfocusedBorderColor = Dakly.colors.line,
            focusedLabelColor = Dakly.colors.ink, focusedContainerColor = Dakly.colors.surface, unfocusedContainerColor = Dakly.colors.surface,
            cursorColor = Dakly.colors.accent,
        ),
    )
}

/** Horizontal chip row used for filters (segments, types, tones). */
@Composable
fun <T> ChoiceChips(options: List<T>, selected: T?, label: @Composable (T) -> String, onSelect: (T) -> Unit, modifier: Modifier = Modifier) {
    androidx.compose.foundation.lazy.LazyRow(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(options.size) { i ->
            val o = options[i]
            val on = o == selected
            androidx.compose.material3.FilterChip(
                selected = on, onClick = { onSelect(o) }, label = { Text(label(o)) },
                shape = RoundedCornerShape(50),
                colors = androidx.compose.material3.FilterChipDefaults.filterChipColors(
                    selectedContainerColor = Dakly.colors.dak, selectedLabelColor = Dakly.colors.dakInk,
                    containerColor = Dakly.colors.surface, labelColor = Dakly.colors.ink2,
                ),
                border = androidx.compose.material3.FilterChipDefaults.filterChipBorder(
                    enabled = true, selected = on, borderColor = Dakly.colors.line, selectedBorderColor = Dakly.colors.dakEdge,
                ),
            )
        }
    }
}

@Composable
fun ConfirmDialog(title: String, body: String, confirm: String, destructive: Boolean = false, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(body) },
        confirmButton = {
            androidx.compose.material3.TextButton(onClick = { onDismiss(); onConfirm() }) {
                Text(confirm, color = if (destructive) Dakly.colors.bad else Dakly.colors.ink, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = { androidx.compose.material3.TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel), color = Dakly.colors.ink2) } },
        containerColor = Dakly.colors.surface,
    )
}

/** Segment colour pair (fg, bg). */
@Composable
fun segmentColors(key: String?): Pair<Color, Color> = when (key) {
    "vip" -> Dakly.colors.haldi to Dakly.colors.haldiSoft
    "inactive" -> Dakly.colors.bad to Dakly.colors.badSoft
    "new" -> Dakly.colors.sky to Dakly.colors.skySoft
    else -> Dakly.colors.leaf to Dakly.colors.leafSoft
}

@Composable
fun statusColors(status: String?): Pair<Color, Color> = when (status) {
    "read", "interested", "published", "sent", "delivered" -> Dakly.colors.leaf to Dakly.colors.leafSoft
    "failed" -> Dakly.colors.bad to Dakly.colors.badSoft
    "scheduled", "queuing", "queued", "sending" -> Dakly.colors.sky to Dakly.colors.skySoft
    "test", "skipped" -> Dakly.colors.haldi to Dakly.colors.haldiSoft
    else -> Dakly.colors.ink2 to Dakly.colors.sunk
}
