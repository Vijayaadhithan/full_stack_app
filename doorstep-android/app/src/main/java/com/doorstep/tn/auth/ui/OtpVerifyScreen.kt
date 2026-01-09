package com.doorstep.tn.auth.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.doorstep.tn.common.localization.Translations
import com.doorstep.tn.common.theme.*

/**
 * OTP Verification Screen - Clean design
 */
@Composable
fun OtpVerifyScreen(
    viewModel: AuthViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToProfileSetup: () -> Unit
) {
    val language by viewModel.language.collectAsState()
    val otp by viewModel.otp.collectAsState()
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
        // Back Button - Top Left
        IconButton(
            onClick = onNavigateBack,
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(top = 44.dp, start = 8.dp)
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Back",
                tint = WhiteText
            )
        }
        
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
                colors = CardDefaults.cardColors(
                    containerColor = SlateCard.copy(alpha = 0.7f)
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
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
                    
                    Spacer(modifier = Modifier.height(28.dp))
                    
                    // OTP icon box
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .background(
                                brush = Brush.linearGradient(
                                    colors = listOf(OrangePrimary, AmberSecondary)
                                ),
                                shape = RoundedCornerShape(14.dp)
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "🔐",
                            fontSize = 28.sp
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(20.dp))
                    
                    Text(
                        text = t.enterOtp,
                        style = MaterialTheme.typography.headlineSmall,
                        color = WhiteText,
                        fontWeight = FontWeight.Bold
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Text(
                        text = when (language) {
                            "ta" -> "+91 $phone க்கு OTP அனுப்பப்பட்டது"
                            else -> "OTP sent to +91 $phone"
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = WhiteTextMuted,
                        textAlign = TextAlign.Center
                    )
                    
                    Spacer(modifier = Modifier.height(32.dp))
                    
                    // OTP Input
                    OutlinedTextField(
                        value = otp,
                        onValueChange = { if (it.length <= 6) viewModel.updateOtp(it) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(72.dp),
                        placeholder = {
                            Text(
                                text = "• • • • • •",
                                color = WhiteTextSubtle,
                                fontSize = 24.sp,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth()
                            )
                        },
                        textStyle = LocalTextStyle.current.copy(
                            fontSize = 28.sp,
                            color = WhiteText,
                            letterSpacing = 8.sp,
                            textAlign = TextAlign.Center
                        ),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Number
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
                    
                    Button(
                        onClick = {
                            viewModel.clearError()
                            viewModel.verifyOtp(onSuccess = onNavigateToProfileSetup)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        enabled = otp.length == 6 && !isLoading,
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
                                text = t.verify,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = WhiteText
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Resend OTP
                    TextButton(onClick = { /* Resend OTP logic */ }) {
                        Text(
                            text = when (language) {
                                "ta" -> "OTP மீண்டும் அனுப்பு"
                                else -> "Resend OTP"
                            },
                            color = OrangePrimary
                        )
                    }
                }
            }
        }
    }
}
