package com.doorstep.tn.auth.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.doorstep.tn.R
import com.doorstep.tn.common.localization.Translations
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.common.ui.LanguageSelector
import com.doorstep.tn.common.ui.TimeBasedGreeting

/**
 * Phone Entry Screen - Clean and premium design
 */
@Composable
fun PhoneEntryScreen(
    viewModel: AuthViewModel,
    onNavigateToPin: () -> Unit,
    onNavigateToOtp: () -> Unit
) {
    val context = LocalContext.current
    val activity = context as? android.app.Activity
    
    val language by viewModel.language.collectAsState()
    val phone by viewModel.phone.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
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
        // Language Selector - Top Right
        LanguageSelector(
            currentLanguage = language,
            onLanguageSelected = { viewModel.setLanguage(it) },
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = 48.dp, end = 16.dp),
            compact = false
        )
        
        // Main Content
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Premium Glass Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(
                    containerColor = SlateCard.copy(alpha = 0.7f)
                ),
                elevation = CardDefaults.cardElevation(
                    defaultElevation = 8.dp
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Top accent line
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(3.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(
                                brush = Brush.horizontalGradient(
                                    colors = listOf(OrangePrimary, TempleGold, AmberSecondary)
                                )
                            )
                    )
                    
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    // Logo
                    Image(
                        painter = painterResource(id = R.drawable.doorstep_logo),
                        contentDescription = "DoorStep Logo",
                        modifier = Modifier
                            .size(72.dp)
                            .clip(RoundedCornerShape(12.dp))
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Title
                    Text(
                        text = "DoorStep",
                        style = MaterialTheme.typography.headlineLarge,
                        color = OrangePrimary,
                        fontWeight = FontWeight.Bold
                    )
                    
                    // Time-based greeting
                    TimeBasedGreeting(
                        language = language,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                    
                    Text(
                        text = t.tagline,
                        style = MaterialTheme.typography.bodyMedium,
                        color = WhiteTextMuted,
                        textAlign = TextAlign.Center
                    )
                    
                    Spacer(modifier = Modifier.height(32.dp))
                    
                    // Phone Input Label
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .background(
                                    brush = Brush.linearGradient(
                                        colors = listOf(OrangePrimary, AmberSecondary)
                                    ),
                                    shape = RoundedCornerShape(8.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Phone,
                                contentDescription = null,
                                tint = WhiteText,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = t.enterPhone,
                            style = MaterialTheme.typography.bodyLarge,
                            color = WhiteText,
                            fontWeight = FontWeight.Medium
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    // Phone Input Field
                    OutlinedTextField(
                        value = phone,
                        onValueChange = { viewModel.updatePhone(it) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(64.dp),
                        placeholder = {
                            Text(
                                text = t.phonePlaceholder,
                                color = WhiteTextSubtle,
                                fontSize = 20.sp
                            )
                        },
                        prefix = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(text = "🇮🇳", fontSize = 18.sp)
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "+91",
                                    color = WhiteTextMuted,
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Box(
                                    modifier = Modifier
                                        .width(1.dp)
                                        .height(24.dp)
                                        .background(GlassBorder)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                            }
                        },
                        textStyle = LocalTextStyle.current.copy(
                            fontSize = 22.sp,
                            color = WhiteText,
                            letterSpacing = 2.sp,
                            fontWeight = FontWeight.Medium
                        ),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Phone
                        ),
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = OrangePrimary,
                            unfocusedBorderColor = GlassBorder,
                            focusedContainerColor = SlateDarker.copy(alpha = 0.5f),
                            unfocusedContainerColor = SlateDarker.copy(alpha = 0.3f)
                        )
                    )
                    
                    // Error message
                    error?.let {
                        Spacer(modifier = Modifier.height(12.dp))
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = ErrorRed.copy(alpha = 0.15f)
                            ),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = it,
                                color = ErrorRed,
                                style = MaterialTheme.typography.bodySmall,
                                textAlign = TextAlign.Center,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp)
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    // Continue Button
                    Button(
                        onClick = {
                            viewModel.clearError()
                            activity?.let { act ->
                                viewModel.checkUser(
                                    activity = act,
                                    onExistingUser = onNavigateToPin,
                                    onNewUser = onNavigateToOtp
                                )
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        enabled = phone.length == 10 && !isLoading,
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = OrangePrimary,
                            disabledContainerColor = OrangePrimary.copy(alpha = 0.4f)
                        )
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = WhiteText,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text(
                                text = t.getOtp,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = WhiteText
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(20.dp))
                    
                    // Trust indicators
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        TrustBadge(
                            icon = Icons.Default.Security,
                            text = t.secure,
                            color = SuccessGreen
                        )
                        TrustBadge(
                            icon = Icons.Default.Verified,
                            text = t.safe,
                            color = PeacockBlue
                        )
                        TrustBadge(
                            icon = Icons.Default.Verified,
                            text = t.trusted,
                            color = TempleGold
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TrustBadge(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    text: String,
    color: androidx.compose.ui.graphics.Color
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = color,
            modifier = Modifier.size(14.dp)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = text,
            color = color,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium
        )
    }
}
