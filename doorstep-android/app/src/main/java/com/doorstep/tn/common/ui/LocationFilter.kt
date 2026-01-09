package com.doorstep.tn.common.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import com.doorstep.tn.common.theme.*

/**
 * Location Filter Component - Matches web UI
 * Shows a dropdown with:
 * - Radius slider (5-100km)
 * - "Use device" and "Saved location" buttons
 * - Clear button
 */
@Composable
fun LocationFilterDropdown(
    currentRadius: Int,
    currentLat: Double?,
    currentLng: Double?,
    onRadiusChange: (Int) -> Unit,
    onUseDeviceLocation: () -> Unit,
    onUseSavedLocation: () -> Unit,
    onClear: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isExpanded by remember { mutableStateOf(false) }
    
    Box(modifier = modifier) {
        // Dropdown trigger button
        Surface(
            modifier = Modifier
                .clip(RoundedCornerShape(24.dp))
                .clickable { isExpanded = !isExpanded }
                .border(
                    width = 1.dp,
                    color = if (currentLat != null) OrangePrimary else GlassBorder,
                    shape = RoundedCornerShape(24.dp)
                ),
            color = if (currentLat != null) OrangePrimary.copy(alpha = 0.15f) else SlateCard
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.LocationOn,
                    contentDescription = null,
                    tint = if (currentLat != null) OrangePrimary else WhiteTextMuted,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = "Location",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (currentLat != null) OrangePrimary else WhiteText
                )
                Icon(
                    imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = null,
                    tint = WhiteTextMuted,
                    modifier = Modifier.size(16.dp)
                )
            }
        }
        
        // Dropdown popup
        if (isExpanded) {
            Popup(
                onDismissRequest = { isExpanded = false },
                properties = PopupProperties(focusable = true)
            ) {
                Card(
                    modifier = Modifier
                        .padding(top = 44.dp)
                        .width(280.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SlateCard),
                    elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // Radius Header
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Radius",
                                style = MaterialTheme.typography.bodyMedium,
                                color = WhiteText,
                                fontWeight = FontWeight.Medium
                            )
                            Text(
                                text = "$currentRadius km",
                                style = MaterialTheme.typography.bodyMedium,
                                color = OrangePrimary,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        
                        // Slider
                        Slider(
                            value = currentRadius.toFloat(),
                            onValueChange = { onRadiusChange(it.toInt()) },
                            valueRange = 5f..100f,
                            steps = 18,
                            colors = SliderDefaults.colors(
                                thumbColor = OrangePrimary,
                                activeTrackColor = OrangePrimary,
                                inactiveTrackColor = GlassWhite
                            )
                        )
                        
                        // Selected Point Display
                        if (currentLat != null && currentLng != null) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "Selected point",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = WhiteTextMuted
                                    )
                                    Text(
                                        text = "Source: Profile",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = WhiteTextMuted
                                    )
                                }
                                Text(
                                    text = "${String.format("%.3f", currentLat)}, ${String.format("%.3f", currentLng)}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = WhiteText,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                        
                        HorizontalDivider(color = GlassBorder, thickness = 1.dp)
                        
                        // Action Buttons - Stacked vertically for better visibility
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            // Use Device Button
                            Button(
                                onClick = {
                                    onUseDeviceLocation()
                                    isExpanded = false
                                },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary),
                                shape = RoundedCornerShape(8.dp),
                                contentPadding = PaddingValues(vertical = 10.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.MyLocation,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Use device location", style = MaterialTheme.typography.labelMedium)
                            }
                            
                            // Saved Location Button
                            OutlinedButton(
                                onClick = {
                                    onUseSavedLocation()
                                    isExpanded = false
                                },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = WhiteText),
                                contentPadding = PaddingValues(vertical = 10.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Home,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Use saved location", style = MaterialTheme.typography.labelMedium)
                            }
                            
                            // Clear Button (only shown when location is set)
                            if (currentLat != null) {
                                TextButton(
                                    onClick = {
                                        onClear()
                                        isExpanded = false
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    contentPadding = PaddingValues(vertical = 6.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Close,
                                        contentDescription = null,
                                        tint = ErrorRed,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Clear location", color = ErrorRed, style = MaterialTheme.typography.labelMedium)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Booking Type Selector - Emergency vs Book for Later
 * Matches web UI with two button options
 */
@Composable
fun BookingTypeSelector(
    selectedType: String, // "emergency" or "scheduled"
    onTypeChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Book for Later Button
        Surface(
            modifier = Modifier
                .clip(RoundedCornerShape(24.dp))
                .clickable { onTypeChange("scheduled") }
                .border(
                    width = if (selectedType == "scheduled") 2.dp else 1.dp,
                    color = if (selectedType == "scheduled") OrangePrimary else GlassBorder,
                    shape = RoundedCornerShape(24.dp)
                ),
            color = if (selectedType == "scheduled") OrangePrimary.copy(alpha = 0.15f) else SlateCard
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.CalendarMonth,
                    contentDescription = null,
                    tint = if (selectedType == "scheduled") OrangePrimary else WhiteTextMuted,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = "Book for later",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (selectedType == "scheduled") OrangePrimary else WhiteText
                )
            }
        }
        
        // Emergency (Now) Button
        Surface(
            modifier = Modifier
                .clip(RoundedCornerShape(24.dp))
                .clickable { onTypeChange("emergency") }
                .border(
                    width = if (selectedType == "emergency") 2.dp else 1.dp,
                    color = if (selectedType == "emergency") ErrorRed else GlassBorder,
                    shape = RoundedCornerShape(24.dp)
                ),
            color = if (selectedType == "emergency") ErrorRed.copy(alpha = 0.15f) else SlateCard
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = if (selectedType == "emergency") ErrorRed else WhiteTextMuted,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = "Emergency",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (selectedType == "emergency") ErrorRed else WhiteText
                )
            }
        }
    }
}
