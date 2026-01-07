package com.doorstep.tn.common.theme

import androidx.compose.ui.graphics.Color

// Orange-Amber Gradient Theme (matching web app)
val OrangePrimary = Color(0xFFF97316)      // orange-500
val OrangeLight = Color(0xFFFB923C)        // orange-400
val OrangeDark = Color(0xFFEA580C)         // orange-600
val AmberSecondary = Color(0xFFF59E0B)     // amber-500
val AmberLight = Color(0xFFFBBF24)         // amber-400

// Background colors (dark theme matching web)
val SlateBackground = Color(0xFF1E293B)    // slate-800
val SlateDarker = Color(0xFF0F172A)        // slate-900
val SlateCard = Color(0xFF334155)          // slate-700

// Text colors
val WhiteText = Color(0xFFFFFFFF)
val WhiteTextMuted = Color(0xB3FFFFFF)     // 70% white
val WhiteTextSubtle = Color(0x66FFFFFF)    // 40% white

// Success/Error/Warning
val SuccessGreen = Color(0xFF10B981)       // emerald-500
val ErrorRed = Color(0xFFEF4444)           // red-500
val WarningYellow = Color(0xFFFBBF24)      // amber-400

// Role colors
val CustomerOrange = OrangePrimary
val ShopGreen = Color(0xFF10B981)          // emerald-500
val ProviderBlue = Color(0xFF3B82F6)       // blue-500

// Glass effect colors
val GlassWhite = Color(0x1AFFFFFF)         // 10% white
val GlassBorder = Color(0x33FFFFFF)        // 20% white

// ==================== Status Colors (matching web exactly) ====================

// Booking Status Colors
val StatusPending = Color(0xFFF59E0B)          // amber-500 - pending
val StatusPendingBg = Color(0x1AF59E0B)        // amber-500 10% opacity
val StatusAccepted = Color(0xFF10B981)         // emerald-500 - accepted
val StatusAcceptedBg = Color(0x1A10B981)       // emerald-500 10% opacity
val StatusRejected = Color(0xFFF43F5E)         // rose-500 - rejected
val StatusRejectedBg = Color(0x1AF43F5E)       // rose-500 10% opacity
val StatusRescheduled = Color(0xFF8B5CF6)      // violet-500 - rescheduled
val StatusRescheduledBg = Color(0x1A8B5CF6)    // violet-500 10% opacity
val StatusCompleted = Color(0xFF0EA5E9)        // sky-500 - completed
val StatusCompletedBg = Color(0x1A0EA5E9)      // sky-500 10% opacity
val StatusCancelled = Color(0xFF64748B)        // slate-500 - cancelled
val StatusCancelledBg = Color(0x1A64748B)      // slate-500 10% opacity
val StatusEnRoute = Color(0xFF3B82F6)          // blue-500 - en_route
val StatusEnRouteBg = Color(0x1A3B82F6)        // blue-500 10% opacity
val StatusAwaitingPayment = Color(0xFF3B82F6)  // blue-500 - awaiting_payment
val StatusAwaitingPaymentBg = Color(0x1A3B82F6)// blue-500 10% opacity
val StatusDisputed = Color(0xFFD97706)         // amber-600 - disputed
val StatusDisputedBg = Color(0x1AD97706)       // amber-600 10% opacity

// Order Status Colors
val StatusConfirmed = Color(0xFF10B981)        // emerald-500
val StatusConfirmedBg = Color(0x1A10B981)
val StatusProcessing = Color(0xFF3B82F6)       // blue-500
val StatusProcessingBg = Color(0x1A3B82F6)
val StatusPacked = Color(0xFF8B5CF6)           // violet-500
val StatusPackedBg = Color(0x1A8B5CF6)
val StatusDispatched = Color(0xFF06B6D4)       // cyan-500
val StatusDispatchedBg = Color(0x1A06B6D4)
val StatusShipped = Color(0xFF0EA5E9)          // sky-500
val StatusShippedBg = Color(0x1A0EA5E9)
val StatusDelivered = Color(0xFF10B981)        // emerald-500
val StatusDeliveredBg = Color(0x1A10B981)
val StatusReturned = Color(0xFFEF4444)         // red-500
val StatusReturnedBg = Color(0x1AEF4444)
