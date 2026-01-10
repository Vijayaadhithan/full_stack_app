package com.doorstep.tn.common.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// Dark color scheme (primary theme for DoorStep - matches web app)
private val DarkColorScheme = darkColorScheme(
    primary = OrangePrimary,
    onPrimary = WhiteText,
    primaryContainer = OrangeDark,
    onPrimaryContainer = WhiteText,
    
    secondary = AmberSecondary,
    onSecondary = SlateBackground,
    secondaryContainer = AmberLight,
    onSecondaryContainer = SlateBackground,
    
    tertiary = ProviderBlue,
    onTertiary = WhiteText,
    
    background = SlateDarker,
    onBackground = WhiteText,
    
    surface = SlateBackground,
    onSurface = WhiteText,
    surfaceVariant = SlateCard,
    onSurfaceVariant = WhiteTextMuted,
    
    error = ErrorRed,
    onError = WhiteText,
    
    outline = GlassBorder,
    outlineVariant = WhiteTextSubtle
)

// Light color scheme (optional, but dark is preferred)
private val LightColorScheme = lightColorScheme(
    primary = OrangePrimary,
    onPrimary = WhiteText,
    primaryContainer = OrangeLight,
    onPrimaryContainer = SlateBackground,
    
    secondary = AmberSecondary,
    onSecondary = SlateBackground,
    secondaryContainer = AmberLight,
    onSecondaryContainer = SlateBackground,
    
    tertiary = ProviderBlue,
    onTertiary = WhiteText,
    
    background = WhiteText,
    onBackground = SlateBackground,
    
    surface = WhiteText,
    onSurface = SlateBackground,
    surfaceVariant = GlassWhite,
    onSurfaceVariant = SlateCard,
    
    error = ErrorRed,
    onError = WhiteText
)

/**
 * DoorStep TN Theme
 * Uses dark theme by default to match the web app's design.
 */
@Composable
fun DoorStepTheme(
    darkTheme: Boolean = true, // Default to dark theme
    dynamicColor: Boolean = false, // Disable dynamic colors to keep brand consistent
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }
    
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = DoorStepTypography,
        content = content
    )
}
