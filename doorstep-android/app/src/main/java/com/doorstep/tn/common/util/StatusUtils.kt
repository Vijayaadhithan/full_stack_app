package com.doorstep.tn.common.util

import androidx.compose.ui.graphics.Color
import com.doorstep.tn.common.theme.*

/**
 * Status utility functions matching web app styling
 */
object StatusUtils {
    
    /**
     * Get booking status color (matching web BOOKING_STATUS_BADGE_CLASSES)
     */
    fun getBookingStatusColor(status: String): Color {
        return when (status.lowercase().replace(" ", "_")) {
            "pending" -> StatusPending           // amber
            "accepted" -> StatusAccepted         // emerald
            "rejected" -> StatusRejected         // rose
            "rescheduled", 
            "rescheduled_by_provider",
            "rescheduled_pending_provider_approval" -> StatusRescheduled  // violet
            "completed" -> StatusCompleted       // sky
            "cancelled", "expired" -> StatusCancelled  // slate
            "en_route" -> StatusEnRoute          // blue
            "awaiting_payment" -> StatusAwaitingPayment  // blue
            "confirmed" -> StatusAccepted        // emerald (same as accepted)
            "in_progress" -> OrangePrimary       // orange
            "disputed" -> StatusDisputed         // amber-600
            else -> WhiteTextMuted
        }
    }
    
    /**
     * Get booking status background color
     */
    fun getBookingStatusBgColor(status: String): Color {
        return when (status.lowercase().replace(" ", "_")) {
            "pending" -> StatusPendingBg
            "accepted" -> StatusAcceptedBg
            "rejected" -> StatusRejectedBg
            "rescheduled", 
            "rescheduled_by_provider",
            "rescheduled_pending_provider_approval" -> StatusRescheduledBg
            "completed" -> StatusCompletedBg
            "cancelled", "expired" -> StatusCancelledBg
            "en_route" -> StatusEnRouteBg
            "awaiting_payment" -> StatusAwaitingPaymentBg
            "confirmed" -> StatusAcceptedBg
            "in_progress" -> OrangePrimary.copy(alpha = 0.1f)
            "disputed" -> StatusDisputedBg
            else -> GlassWhite
        }
    }
    
    /**
     * Get order status color (matching web orderStatusLabels)
     */
    fun getOrderStatusColor(status: String): Color {
        return when (status.lowercase()) {
            "pending" -> StatusPending           // amber
            "awaiting_customer_agreement" -> StatusPending  // amber
            "confirmed" -> StatusConfirmed       // emerald
            "processing" -> StatusProcessing     // blue
            "packed" -> StatusPacked             // violet
            "dispatched" -> StatusDispatched     // cyan
            "shipped" -> StatusShipped           // sky
            "delivered" -> StatusDelivered       // emerald
            "cancelled" -> StatusCancelled       // slate
            "returned" -> StatusReturned         // red
            else -> WhiteTextMuted
        }
    }
    
    /**
     * Get order status background color
     */
    fun getOrderStatusBgColor(status: String): Color {
        return when (status.lowercase()) {
            "pending" -> StatusPendingBg
            "awaiting_customer_agreement" -> StatusPendingBg
            "confirmed" -> StatusConfirmedBg
            "processing" -> StatusProcessingBg
            "packed" -> StatusPackedBg
            "dispatched" -> StatusDispatchedBg
            "shipped" -> StatusShippedBg
            "delivered" -> StatusDeliveredBg
            "cancelled" -> StatusCancelledBg
            "returned" -> StatusReturnedBg
            else -> GlassWhite
        }
    }
    
    /**
     * Get human-readable booking status label
     */
    fun getBookingStatusLabel(status: String): String {
        return when (status.lowercase().replace(" ", "_")) {
            "pending" -> "Pending"
            "accepted" -> "Accepted"
            "rejected" -> "Rejected"
            "rescheduled" -> "Rescheduled"
            "rescheduled_by_provider" -> "Rescheduled by Provider"
            "rescheduled_pending_provider_approval" -> "Reschedule Pending"
            "completed" -> "Completed"
            "cancelled" -> "Cancelled"
            "expired" -> "Expired"
            "en_route" -> "En Route"
            "awaiting_payment" -> "Awaiting Payment"
            "confirmed" -> "Confirmed"
            "in_progress" -> "In Progress"
            "disputed" -> "Disputed"
            else -> status.replaceFirstChar { it.uppercase() }
        }
    }
    
    /**
     * Get human-readable order status label
     */
    fun getOrderStatusLabel(status: String): String {
        return when (status.lowercase()) {
            "pending" -> "Sent to Shop"
            "awaiting_customer_agreement" -> "Awaiting Confirmation"
            "confirmed" -> "Confirmed"
            "processing" -> "Processing"
            "packed" -> "Packed"
            "dispatched" -> "Dispatched"
            "shipped" -> "Shipped"
            "delivered" -> "Delivered"
            "cancelled" -> "Cancelled"
            "returned" -> "Returned"
            else -> status.replaceFirstChar { it.uppercase() }
        }
    }
}
