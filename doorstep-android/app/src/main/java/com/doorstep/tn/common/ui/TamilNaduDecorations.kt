package com.doorstep.tn.common.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.doorstep.tn.common.localization.Translations
import com.doorstep.tn.common.theme.*
import java.util.Calendar

/**
 * Tamil Nadu Decorative Components
 * Culturally resonant UI elements for the DoorStep app
 */

/**
 * Kolam-inspired corner decoration
 */
@Composable
fun KolamCorner(
    modifier: Modifier = Modifier,
    color: Color = TempleGold.copy(alpha = 0.3f),
    size: Dp = 60.dp
) {
    Canvas(modifier = modifier.size(size)) {
        val centerX = size.toPx() / 2
        val centerY = size.toPx() / 2
        val radius = size.toPx() / 3
        
        // Draw kolam dots pattern
        val dotRadius = size.toPx() / 20
        val positions = listOf(
            Offset(centerX, centerY),
            Offset(centerX - radius * 0.5f, centerY - radius * 0.5f),
            Offset(centerX + radius * 0.5f, centerY - radius * 0.5f),
            Offset(centerX - radius * 0.5f, centerY + radius * 0.5f),
            Offset(centerX + radius * 0.5f, centerY + radius * 0.5f),
        )
        
        positions.forEach { pos ->
            drawCircle(
                color = color,
                radius = dotRadius,
                center = pos
            )
        }
        
        // Draw connecting curves (simplified kolam pattern)
        val path = Path().apply {
            moveTo(positions[1].x, positions[1].y)
            quadraticBezierTo(centerX, centerY - radius, positions[2].x, positions[2].y)
            quadraticBezierTo(centerX + radius, centerY, positions[4].x, positions[4].y)
            quadraticBezierTo(centerX, centerY + radius, positions[3].x, positions[3].y)
            quadraticBezierTo(centerX - radius, centerY, positions[1].x, positions[1].y)
        }
        
        drawPath(
            path = path,
            color = color,
            style = Stroke(width = 2.dp.toPx())
        )
    }
}

/**
 * Animated Kolam pattern for loading states
 */
@Composable
fun AnimatedKolam(
    modifier: Modifier = Modifier,
    color: Color = TempleGold
) {
    val infiniteTransition = rememberInfiniteTransition(label = "kolam_rotation")
    val rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(4000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "kolam_rotate"
    )
    
    Canvas(modifier = modifier.size(80.dp)) {
        val center = Offset(size.width / 2, size.height / 2)
        val radius = size.width / 3
        
        // Draw rotating petals (8-petal kolam flower)
        for (i in 0 until 8) {
            val angle = (i * 45f + rotation) * (Math.PI / 180)
            val petalEnd = Offset(
                center.x + (radius * kotlin.math.cos(angle)).toFloat(),
                center.y + (radius * kotlin.math.sin(angle)).toFloat()
            )
            
            drawLine(
                color = color.copy(alpha = 0.6f),
                start = center,
                end = petalEnd,
                strokeWidth = 3.dp.toPx()
            )
            
            // Dot at petal end
            drawCircle(
                color = color,
                radius = 6.dp.toPx(),
                center = petalEnd
            )
        }
        
        // Center dot
        drawCircle(
            color = color,
            radius = 8.dp.toPx(),
            center = center
        )
    }
}

/**
 * Time-based greeting component - compact version for TopAppBar
 */
@Composable
fun TimeBasedGreeting(
    language: String,
    userName: String? = null,
    modifier: Modifier = Modifier
) {
    val t = Translations.get(language)
    val calendar = Calendar.getInstance()
    val hour = calendar.get(Calendar.HOUR_OF_DAY)
    
    val greeting = when {
        hour in 5..11 -> t.goodMorning
        hour in 12..16 -> t.goodAfternoon
        else -> t.goodEvening
    }
    
    Column(modifier = modifier) {
        Text(
            text = greeting,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = OrangePrimary,
            maxLines = 1
        )
        userName?.let { name ->
            Text(
                text = name,
                style = MaterialTheme.typography.bodySmall,
                color = WhiteTextMuted,
                maxLines = 1,
                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
            )
        }
    }
}

/**
 * Festival Banner - Shows during Tamil Nadu festivals
 */
@Composable
fun FestivalBanner(
    modifier: Modifier = Modifier
) {
    val calendar = Calendar.getInstance()
    val month = calendar.get(Calendar.MONTH)
    val day = calendar.get(Calendar.DAY_OF_MONTH)
    
    // Simple festival detection (can be enhanced)
    val festival: Pair<String, List<Color>>? = when {
        // Thai Pongal - January 14-17
        month == Calendar.JANUARY && day in 14..17 -> {
            "🎉 இனிய பொங்கல் நல்வாழ்த்துக்கள்! 🌾" to listOf(PongalSaffron, TempleGold)
        }
        // Deepavali - roughly October/November (simplified)
        month == Calendar.OCTOBER && day in 20..30 -> {
            "✨ தீபாவளி நல்வாழ்த்துக்கள்! 🪔" to listOf(TempleGold, MangoYellow)
        }
        // Tamil New Year - April 14
        month == Calendar.APRIL && day == 14 -> {
            "🌸 தமிழ் புத்தாண்டு நல்வாழ்த்துக்கள்! 🎊" to listOf(OrangePrimary, AmberSecondary)
        }
        else -> null
    }
    
    festival?.let { (message, colors) ->
        Card(
            modifier = modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.Transparent)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        brush = Brush.linearGradient(colors = colors)
                    )
                    .padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = message,
                    color = WhiteText,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    fontSize = 16.sp
                )
            }
        }
    }
}

/**
 * Premium Gradient Card - Tamil Nadu sunset inspired
 */
@Composable
fun GradientCard(
    modifier: Modifier = Modifier,
    gradientType: GradientType = GradientType.SUNSET,
    content: @Composable () -> Unit
) {
    val colors = when (gradientType) {
        GradientType.SUNSET -> listOf(SunsetOrange, SunsetGold)
        GradientType.TEMPLE_GOLD -> listOf(TempleGold, MangoYellow)
        GradientType.PEACOCK -> listOf(GradientPeacock, GradientPeacockDark)
        GradientType.PONGAL -> listOf(PongalSaffron, PongalGreen)
        GradientType.SILK -> listOf(SilkMaroon, TempleGold)
    }
    
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    brush = Brush.linearGradient(colors = colors)
                )
        ) {
            content()
        }
    }
}

enum class GradientType {
    SUNSET,
    TEMPLE_GOLD,
    PEACOCK,
    PONGAL,
    SILK
}

/**
 * Glass Card with subtle kolam-inspired border
 */
@Composable
fun TamilNaduGlassCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp)),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = GlassWhite
        )
    ) {
        Box {
            // Subtle corner decorations
            KolamCorner(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .alpha(0.3f),
                color = TempleGold,
                size = 40.dp
            )
            KolamCorner(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .alpha(0.3f),
                color = TempleGold,
                size = 40.dp
            )
            
            Column(
                modifier = Modifier.padding(24.dp),
                content = content
            )
        }
    }
}

/**
 * Decorative divider with Tamil Nadu pattern
 */
@Composable
fun TamilNaduDivider(
    modifier: Modifier = Modifier,
    color: Color = TempleGold.copy(alpha = 0.3f)
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Divider(
            modifier = Modifier.weight(1f),
            color = color,
            thickness = 1.dp
        )
        
        // Center diamond pattern
        Canvas(modifier = Modifier.size(16.dp)) {
            val center = Offset(size.width / 2, size.height / 2)
            val path = Path().apply {
                moveTo(center.x, 0f)
                lineTo(size.width, center.y)
                lineTo(center.x, size.height)
                lineTo(0f, center.y)
                close()
            }
            drawPath(path = path, color = color)
        }
        
        Divider(
            modifier = Modifier.weight(1f),
            color = color,
            thickness = 1.dp
        )
    }
}

/**
 * Animated pulse for important elements
 */
@Composable
fun PulsingGlow(
    modifier: Modifier = Modifier,
    color: Color = OrangePrimary,
    content: @Composable () -> Unit
) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 0.7f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_alpha"
    )
    
    Box(modifier = modifier) {
        // Glow layer
        Box(
            modifier = Modifier
                .matchParentSize()
                .background(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            color.copy(alpha = alpha * 0.5f),
                            Color.Transparent
                        )
                    ),
                    shape = RoundedCornerShape(16.dp)
                )
        )
        content()
    }
}
