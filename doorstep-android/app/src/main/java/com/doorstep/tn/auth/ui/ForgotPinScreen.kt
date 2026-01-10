package com.doorstep.tn.auth.ui

import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.doorstep.tn.common.localization.Translations
import com.doorstep.tn.common.theme.*

/**
 * Forgot PIN Screen - Allows users to reset their PIN via phone OTP
 * Matches the web app's ForgotPassword flow
 */
@Composable
fun ForgotPinScreen(
    viewModel: AuthViewModel,
    onNavigateBack: () -> Unit,
    onPinResetSuccess: () -> Unit
) {
    val context = LocalContext.current
    val activity = context as? Activity
    
    val language by viewModel.language.collectAsState()
    val phone by viewModel.phone.collectAsState()
    val otp by viewModel.otp.collectAsState()
    val pin by viewModel.pin.collectAsState()
    val confirmPin by viewModel.confirmPin.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    
    val t = Translations.get(language)
    
    // Track which step we're on
    var step by remember { mutableStateOf("phone") } // "phone", "otp", "new-pin", "success"
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(SlateBackground, SlateDarker)
                )
            )
    ) {
        // Language Toggle
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
            Text(text = t.switchLang, color = WhiteTextMuted)
        }
        
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
                colors = CardDefaults.cardColors(containerColor = GlassWhite)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Back Button (not shown on success)
                    if (step != "success") {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Start
                        ) {
                            TextButton(
                                onClick = {
                                    if (step == "phone") {
                                        onNavigateBack()
                                    } else {
                                        step = "phone"
                                        viewModel.clearError()
                                    }
                                }
                            ) {
                                Icon(
                                    Icons.AutoMirrored.Filled.ArrowBack,
                                    contentDescription = "Back",
                                    tint = WhiteTextMuted
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(t.back, color = WhiteTextMuted)
                            }
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Title with icon
                    when (step) {
                        "success" -> {
                            Icon(
                                Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = SuccessGreen,
                                modifier = Modifier.size(64.dp)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = t.pinResetSuccess,
                                style = MaterialTheme.typography.headlineMedium,
                                color = OrangePrimary,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        else -> {
                            Icon(
                                if (step == "phone") Icons.Default.Phone else Icons.Default.Lock,
                                contentDescription = null,
                                tint = OrangePrimary,
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = t.resetPin,
                                style = MaterialTheme.typography.headlineMedium,
                                color = OrangePrimary,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = when (step) {
                                    "phone" -> t.enterPhoneToReset
                                    "otp" -> "${t.otpSentTo} +91 $phone"
                                    else -> t.createNewPin
                                },
                                style = MaterialTheme.typography.bodyMedium,
                                color = WhiteTextMuted
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(24.dp))
                    
                    // Error message
                    error?.let {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = ErrorRed.copy(alpha = 0.2f)),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text(
                                text = it,
                                color = ErrorRed,
                                modifier = Modifier.padding(16.dp),
                                textAlign = TextAlign.Center
                            )
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                    }
                    
                    // Step: Phone Entry
                    if (step == "phone") {
                        OutlinedTextField(
                            value = phone,
                            onValueChange = { viewModel.updatePhone(it) },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text(t.phoneNumber) },
                            prefix = { Text("+91 ", color = WhiteTextMuted) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = OrangePrimary,
                                unfocusedBorderColor = GlassBorder
                            )
                        )
                        
                        Spacer(modifier = Modifier.height(24.dp))
                        
                        Button(
                            onClick = {
                                viewModel.clearError()
                                activity?.let { act ->
                                    viewModel.sendOtpWithActivity(act) {
                                        step = "otp"
                                    }
                                }
                            },
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                            enabled = phone.length == 10 && !isLoading,
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary)
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(24.dp),
                                    color = WhiteText,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text(t.sendOtp, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                    
                    // Step: OTP Entry
                    if (step == "otp") {
                        OutlinedTextField(
                            value = otp,
                            onValueChange = { viewModel.updateOtp(it) },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text(t.enterOtp) },
                            placeholder = { Text("• • • • • •") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = OrangePrimary,
                                unfocusedBorderColor = GlassBorder
                            )
                        )
                        
                        Spacer(modifier = Modifier.height(24.dp))
                        
                        Button(
                            onClick = {
                                viewModel.clearError()
                                viewModel.verifyOtp {
                                    step = "new-pin"
                                }
                            },
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                            enabled = otp.length == 6 && !isLoading,
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary)
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(24.dp),
                                    color = WhiteText,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text(t.verifyOtp, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        TextButton(
                            onClick = {
                                activity?.let { act ->
                                    viewModel.sendOtpWithActivity(act) {}
                                }
                            },
                            enabled = !isLoading
                        ) {
                            Text(t.resendOtp, color = WhiteTextMuted)
                        }
                    }
                    
                    // Step: New PIN
                    if (step == "new-pin") {
                        OutlinedTextField(
                            value = pin,
                            onValueChange = { viewModel.updatePin(it) },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text(t.newPin) },
                            placeholder = { Text("• • • •") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                            visualTransformation = PasswordVisualTransformation(),
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = OrangePrimary,
                                unfocusedBorderColor = GlassBorder
                            )
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        OutlinedTextField(
                            value = confirmPin,
                            onValueChange = { viewModel.updateConfirmPin(it) },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text(t.confirmPin) },
                            placeholder = { Text("• • • •") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                            visualTransformation = PasswordVisualTransformation(),
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = OrangePrimary,
                                unfocusedBorderColor = GlassBorder
                            )
                        )
                        
                        Spacer(modifier = Modifier.height(24.dp))
                        
                        Button(
                            onClick = {
                                viewModel.clearError()
                                viewModel.resetPin {
                                    step = "success"
                                }
                            },
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                            enabled = pin.length == 4 && confirmPin.length == 4 && !isLoading,
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary)
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(24.dp),
                                    color = WhiteText,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text(t.resetPin, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                    
                    // Step: Success
                    if (step == "success") {
                        Text(
                            text = t.pinResetSuccessMessage,
                            color = WhiteTextMuted,
                            textAlign = TextAlign.Center
                        )
                        
                        Spacer(modifier = Modifier.height(24.dp))
                        
                        Button(
                            onClick = onPinResetSuccess,
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary)
                        ) {
                            Text(t.backToLogin, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }
}
