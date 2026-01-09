package com.doorstep.tn.common.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Language
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.doorstep.tn.common.localization.Translations
import com.doorstep.tn.common.theme.*

/**
 * Language Selector Dropdown
 * Beautiful, animated dropdown for switching between English, Tamil, and Thanglish
 */
@Composable
fun LanguageSelector(
    currentLanguage: String,
    onLanguageSelected: (String) -> Unit,
    modifier: Modifier = Modifier,
    compact: Boolean = false
) {
    var expanded by remember { mutableStateOf(false) }
    val rotationAngle by animateFloatAsState(
        targetValue = if (expanded) 180f else 0f,
        label = "dropdown_rotation"
    )
    
    val languages = Translations.getLanguageList()
    val currentLang = languages.find { it.code == currentLanguage } ?: Translations.Language.ENGLISH
    
    Column(modifier = modifier) {
        // Dropdown trigger button
        Surface(
            modifier = Modifier
                .clip(RoundedCornerShape(12.dp))
                .clickable { expanded = !expanded }
                .border(
                    width = 1.dp,
                    brush = Brush.linearGradient(
                        colors = listOf(GlassBorder, OrangePrimary.copy(alpha = 0.3f))
                    ),
                    shape = RoundedCornerShape(12.dp)
                ),
            color = GlassWhite,
            shape = RoundedCornerShape(12.dp)
        ) {
            Row(
                modifier = Modifier.padding(
                    horizontal = if (compact) 12.dp else 16.dp,
                    vertical = if (compact) 8.dp else 12.dp
                ),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Language,
                    contentDescription = null,
                    tint = OrangePrimary,
                    modifier = Modifier.size(if (compact) 18.dp else 20.dp)
                )
                
                if (!compact) {
                    Text(
                        text = currentLang.nativeName,
                        color = WhiteText,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
                
                Icon(
                    imageVector = Icons.Default.KeyboardArrowDown,
                    contentDescription = null,
                    tint = WhiteTextMuted,
                    modifier = Modifier
                        .size(if (compact) 16.dp else 20.dp)
                        .rotate(rotationAngle)
                )
            }
        }
        
        // Dropdown menu
        AnimatedVisibility(
            visible = expanded,
            enter = fadeIn() + expandVertically(),
            exit = fadeOut() + shrinkVertically()
        ) {
            Surface(
                modifier = Modifier
                    .padding(top = 4.dp)
                    .fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                color = SlateCard,
                shadowElevation = 8.dp
            ) {
                Column(
                    modifier = Modifier.padding(8.dp)
                ) {
                    languages.forEach { language ->
                        val isSelected = language.code == currentLanguage
                        
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(
                                    if (isSelected) OrangePrimary.copy(alpha = 0.2f)
                                    else androidx.compose.ui.graphics.Color.Transparent
                                )
                                .clickable {
                                    onLanguageSelected(language.code)
                                    expanded = false
                                }
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = language.nativeName,
                                    color = if (isSelected) OrangePrimary else WhiteText,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    fontSize = 15.sp
                                )
                                if (language.code != "en") {
                                    Text(
                                        text = language.displayName,
                                        color = WhiteTextMuted,
                                        fontSize = 12.sp
                                    )
                                }
                            }
                            
                            if (isSelected) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = OrangePrimary,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Compact language toggle button for app bars
 */
@Composable
fun LanguageToggleButton(
    currentLanguage: String,
    onLanguageSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var showDropdown by remember { mutableStateOf(false) }
    
    Box(modifier = modifier) {
        IconButton(
            onClick = { showDropdown = true }
        ) {
            Icon(
                imageVector = Icons.Default.Language,
                contentDescription = "Change Language",
                tint = WhiteText
            )
        }
        
        DropdownMenu(
            expanded = showDropdown,
            onDismissRequest = { showDropdown = false },
            modifier = Modifier.background(SlateCard)
        ) {
            Translations.getLanguageList().forEach { language ->
                val isSelected = language.code == currentLanguage
                
                DropdownMenuItem(
                    text = {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = language.nativeName,
                                color = if (isSelected) OrangePrimary else WhiteText,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            )
                            if (isSelected) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = OrangePrimary,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    },
                    onClick = {
                        onLanguageSelected(language.code)
                        showDropdown = false
                    }
                )
            }
        }
    }
}
