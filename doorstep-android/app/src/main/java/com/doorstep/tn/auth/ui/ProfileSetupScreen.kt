package com.doorstep.tn.auth.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.doorstep.tn.common.localization.Translations
import com.doorstep.tn.common.theme.*

/**
 * Profile Setup Screen for new users
 */
@Composable
fun ProfileSetupScreen(
    viewModel: AuthViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToPinSetup: () -> Unit
) {
    val language by viewModel.language.collectAsState()
    val name by viewModel.name.collectAsState()
    val selectedRole by viewModel.selectedRole.collectAsState()
    val error by viewModel.error.collectAsState()
    
    val t = Translations.get(language)
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(SlateBackground, SlateDarker)
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = GlassWhite)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Back button
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Start
                    ) {
                        TextButton(onClick = onNavigateBack) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = WhiteTextMuted
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(text = t.back, color = WhiteTextMuted)
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    // Name Input
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = null,
                            tint = WhiteTextMuted,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = t.yourName,
                            style = MaterialTheme.typography.bodyMedium,
                            color = WhiteTextMuted
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    OutlinedTextField(
                        value = name,
                        onValueChange = { viewModel.updateName(it) },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = {
                            Text(
                                text = if (language == "en") "Your name" else "உங்கள் பெயர்",
                                color = WhiteTextSubtle
                            )
                        },
                        textStyle = LocalTextStyle.current.copy(
                            fontSize = 18.sp,
                            color = WhiteText
                        ),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = OrangePrimary,
                            unfocusedBorderColor = GlassBorder,
                            focusedContainerColor = GlassWhite,
                            unfocusedContainerColor = GlassWhite
                        )
                    )
                    
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    // Role Selection - Dropdown Style (matching web implementation)
                    Text(
                        text = t.chooseRole,
                        style = MaterialTheme.typography.bodyMedium,
                        color = WhiteTextMuted,
                        modifier = Modifier.fillMaxWidth()
                    )
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    // Dropdown selector
                    RoleDropdownSelector(
                        selectedRole = selectedRole,
                        language = language,
                        onRoleSelected = { viewModel.updateSelectedRole(it) }
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Visual role cards below dropdown for additional context
                    Text(
                        text = if (language == "en") "Role Details:" else "பங்கு விவரங்கள்:",
                        style = MaterialTheme.typography.labelMedium,
                        color = WhiteTextSubtle,
                        modifier = Modifier.fillMaxWidth()
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    // Role buttons (clickable cards with descriptions)
                    RoleButton(
                        icon = Icons.Default.PersonOutline,
                        title = t.customer,
                        description = t.customerDesc,
                        isSelected = selectedRole == "customer",
                        color = CustomerOrange,
                        onClick = { viewModel.updateSelectedRole("customer") }
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    RoleButton(
                        icon = Icons.Default.Store,
                        title = t.shopOwner,
                        description = t.shopDesc,
                        isSelected = selectedRole == "shop",
                        color = ShopGreen,
                        onClick = { viewModel.updateSelectedRole("shop") }
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    RoleButton(
                        icon = Icons.Default.Build,
                        title = t.provider,
                        description = t.providerDesc,
                        isSelected = selectedRole == "provider",
                        color = ProviderBlue,
                        onClick = { viewModel.updateSelectedRole("provider") }
                    )
                    
                    error?.let {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = it,
                            color = ErrorRed,
                            style = MaterialTheme.typography.bodySmall,
                            textAlign = TextAlign.Center
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    Button(
                        onClick = onNavigateToPinSetup,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        enabled = name.isNotBlank(),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = OrangePrimary
                        )
                    ) {
                        Text(
                            text = t.next,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }
    }
}

/**
 * Dropdown selector for role selection - matches web implementation
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RoleDropdownSelector(
    selectedRole: String,
    language: String,
    onRoleSelected: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    
    val roles = listOf(
        Triple("customer", 
            if (language == "en") "Customer" else "வாடிக்கையாளர்",
            CustomerOrange
        ),
        Triple("shop",
            if (language == "en") "Shop Owner" else "கடை உரிமையாளர்",
            ShopGreen
        ),
        Triple("provider",
            if (language == "en") "Service Provider" else "சேவை வழங்குநர்",
            ProviderBlue
        )
    )
    
    val selectedRoleData = roles.find { it.first == selectedRole } ?: roles[0]
    
    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it }
    ) {
        OutlinedTextField(
            value = selectedRoleData.second,
            onValueChange = {},
            readOnly = true,
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
            leadingIcon = {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(selectedRoleData.third),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = when (selectedRole) {
                            "customer" -> Icons.Default.PersonOutline
                            "shop" -> Icons.Default.Store
                            else -> Icons.Default.Build
                        },
                        contentDescription = null,
                        tint = WhiteText,
                        modifier = Modifier.size(18.dp)
                    )
                }
            },
            trailingIcon = {
                ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
            },
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = selectedRoleData.third,
                unfocusedBorderColor = GlassBorder,
                focusedContainerColor = GlassWhite,
                unfocusedContainerColor = GlassWhite,
                focusedTextColor = WhiteText,
                unfocusedTextColor = WhiteText
            )
        )
        
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            roles.forEach { (roleKey, roleLabel, roleColor) ->
                DropdownMenuItem(
                    text = {
                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(28.dp)
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(roleColor),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = when (roleKey) {
                                        "customer" -> Icons.Default.PersonOutline
                                        "shop" -> Icons.Default.Store
                                        else -> Icons.Default.Build
                                    },
                                    contentDescription = null,
                                    tint = WhiteText,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = roleLabel,
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = if (selectedRole == roleKey) FontWeight.Bold else FontWeight.Normal
                            )
                            if (selectedRole == roleKey) {
                                Spacer(modifier = Modifier.weight(1f))
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = roleColor,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    },
                    onClick = {
                        onRoleSelected(roleKey)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun RoleButton(
    icon: ImageVector,
    title: String,
    description: String,
    isSelected: Boolean,
    color: androidx.compose.ui.graphics.Color,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .then(
                if (isSelected) {
                    Modifier.border(2.dp, color, RoundedCornerShape(12.dp))
                } else {
                    Modifier.border(1.dp, GlassBorder, RoundedCornerShape(12.dp))
                }
            )
            .background(if (isSelected) color.copy(alpha = 0.1f) else GlassWhite)
            .clickable(onClick = onClick)
            .padding(16.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (isSelected) color else GlassBorder),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = WhiteText,
                    modifier = Modifier.size(24.dp)
                )
            }
            
            Spacer(modifier = Modifier.width(16.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    color = if (isSelected) WhiteText else WhiteTextMuted,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = WhiteTextSubtle
                )
            }
            
            if (isSelected) {
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(color),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = null,
                        tint = WhiteText,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}
