package com.doorstep.tn.auth.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
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

/**
 * Phone Entry Screen - First step of authentication
 * Matches the web app's RuralAuthFlow design
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
        // Language Toggle - Top Right
        TextButton(
            onClick = { viewModel.toggleLanguage() },
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(16.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Language,
                contentDescription = "Language",
                tint = WhiteTextMuted,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = t.switchLang,
                color = WhiteTextMuted
            )
        }
        
        // Main Content
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Glass Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(
                    containerColor = GlassWhite
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // DoorStep Logo
                    Image(
                        painter = painterResource(id = R.drawable.doorstep_logo),
                        contentDescription = "DoorStep Logo",
                        modifier = Modifier
                            .size(80.dp)
                            .clip(RoundedCornerShape(16.dp))
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Title
                    Text(
                        text = "DoorStep",
                        style = MaterialTheme.typography.headlineLarge,
                        color = OrangePrimary,
                        fontWeight = FontWeight.Bold
                    )
                    
                    Text(
                        text = t.tagline,
                        style = MaterialTheme.typography.bodyMedium,
                        color = WhiteTextMuted
                    )
                    
                    Spacer(modifier = Modifier.height(32.dp))
                    
                    // Phone Input Label
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Phone,
                            contentDescription = null,
                            tint = WhiteTextMuted,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = t.enterPhone,
                            style = MaterialTheme.typography.bodyMedium,
                            color = WhiteTextMuted
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    // Phone Input
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
                            Text(
                                text = "+91 ",
                                color = WhiteTextMuted,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        },
                        textStyle = LocalTextStyle.current.copy(
                            fontSize = 20.sp,
                            color = WhiteText,
                            letterSpacing = 2.sp
                        ),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Phone
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
                    
                    // Error message
                    error?.let {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = it,
                            color = ErrorRed,
                            style = MaterialTheme.typography.bodySmall,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
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
                            } ?: run {
                                // Fallback if activity is null (shouldn't happen)
                                viewModel.clearError()
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        enabled = phone.length == 10 && !isLoading,
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = OrangePrimary,
                            disabledContainerColor = OrangePrimary.copy(alpha = 0.5f)
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
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Trust indicators
                    Row(
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Security,
                            contentDescription = null,
                            tint = WhiteTextSubtle,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Secure",
                            color = WhiteTextSubtle,
                            fontSize = 12.sp
                        )
                        Spacer(modifier = Modifier.width(16.dp))
                        Text(
                            text = "•",
                            color = WhiteTextSubtle
                        )
                        Spacer(modifier = Modifier.width(16.dp))
                        Text(
                            text = "100% Safe",
                            color = WhiteTextSubtle,
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }
    }
}
