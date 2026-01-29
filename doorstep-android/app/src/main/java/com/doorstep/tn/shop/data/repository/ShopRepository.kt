package com.doorstep.tn.shop.data.repository

import com.doorstep.tn.core.network.DoorStepApi
import com.doorstep.tn.shop.data.model.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for shop-specific API operations
 */
@Singleton
class ShopRepository @Inject constructor(
    private val api: DoorStepApi
) {
    // ─── Dashboard ──────────────────────────────────────────────────────────────
    
    suspend fun getDashboardStats(): Result<DashboardStats> = try {
        val response = api.getShopDashboardStats()
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to fetch dashboard stats")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun getRecentOrders(): Result<List<ShopOrder>> = try {
        val response = api.getRecentShopOrders()
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to fetch recent orders")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun getShopReviews(shopId: Int): Result<List<ShopReview>> = try {
        val response = api.getShopReviews(shopId)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to fetch reviews")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    // ─── Orders ─────────────────────────────────────────────────────────────────
    
    suspend fun getActiveOrdersBoard(): Result<ActiveBoardResponse> = try {
        val response = api.getActiveOrdersBoard()
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to fetch active orders")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun getOrders(status: String? = null): Result<List<ShopOrder>> = try {
        val response = api.getShopOrders(status)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to fetch orders")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun updateOrderStatus(
        orderId: Int,
        status: String,
        comments: String? = null,
        trackingInfo: String? = null
    ): Result<ShopOrder> = try {
        val request = UpdateOrderStatusRequest(status, comments, trackingInfo)
        val response = api.updateShopOrderStatus(orderId, request)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to update order status")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    // ─── Products ───────────────────────────────────────────────────────────────
    
    suspend fun getProducts(shopId: Int): Result<List<ShopProduct>> = try {
        val response = api.getMyShopProducts(shopId)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to fetch products")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun createProduct(request: CreateProductRequest): Result<ShopProduct> = try {
        val response = api.createProduct(request)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to create product")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun updateProduct(
        productId: Int,
        request: UpdateProductRequest
    ): Result<ShopProduct> = try {
        val response = api.updateProduct(productId, request)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to update product")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun deleteProduct(productId: Int): Result<Unit> = try {
        val response = api.deleteProduct(productId)
        if (response.isSuccessful) {
            Result.Success(Unit)
        } else {
            Result.Error(response.message() ?: "Failed to delete product")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun updateProductStock(
        productId: Int,
        stock: Int,
        isAvailable: Boolean? = null
    ): Result<ShopProduct> = try {
        val body = mutableMapOf<String, Any>("stock" to stock)
        isAvailable?.let { body["isAvailable"] = it }
        val response = api.updateProductStock(productId, body)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to update stock")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    // ─── Promotions ─────────────────────────────────────────────────────────────
    
    suspend fun getPromotions(shopId: Int): Result<List<ShopPromotion>> = try {
        val response = api.getShopPromotions(shopId)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to fetch promotions")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun createPromotion(request: CreatePromotionRequest): Result<ShopPromotion> = try {
        val response = api.createPromotion(request)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to create promotion")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun updatePromotion(
        promotionId: Int,
        request: UpdatePromotionRequest
    ): Result<ShopPromotion> = try {
        val response = api.updatePromotion(promotionId, request)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to update promotion")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun deletePromotion(promotionId: Int): Result<Unit> = try {
        val response = api.deletePromotion(promotionId)
        if (response.isSuccessful) {
            Result.Success(Unit)
        } else {
            Result.Error(response.message() ?: "Failed to delete promotion")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun togglePromotionStatus(
        promotionId: Int,
        isActive: Boolean
    ): Result<ShopPromotion> = try {
        val request = UpdatePromotionRequest(isActive = isActive)
        val response = api.updatePromotion(promotionId, request)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to toggle promotion status")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    // ─── Workers ────────────────────────────────────────────────────────────────
    
    suspend fun getWorkers(): Result<List<ShopWorker>> = try {
        val response = api.getShopWorkers()
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to fetch workers")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun getWorkerResponsibilities(): Result<WorkerResponsibilitiesResponse> = try {
        val response = api.getWorkerResponsibilities()
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to fetch worker responsibilities")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun checkWorkerNumber(workerNumber: String): Result<Map<String, Any>> = try {
        val response = api.checkWorkerNumber(workerNumber)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to check worker number")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun addWorker(request: AddWorkerRequest): Result<ShopWorker> = try {
        val response = api.addShopWorker(request)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!.worker ?: throw Exception("Worker not returned"))
        } else {
            Result.Error(response.message() ?: "Failed to add worker")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun updateWorker(
        workerUserId: Int,
        request: UpdateWorkerRequest
    ): Result<ShopWorker> = try {
        val response = api.updateShopWorker(workerUserId, request)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!.worker ?: throw Exception("Worker not returned"))
        } else {
            Result.Error(response.message() ?: "Failed to update worker")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun removeWorker(workerUserId: Int): Result<Unit> = try {
        val response = api.removeShopWorker(workerUserId)
        if (response.isSuccessful) {
            Result.Success(Unit)
        } else {
            Result.Error(response.message() ?: "Failed to remove worker")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun toggleWorkerStatus(
        workerUserId: Int,
        active: Boolean
    ): Result<ShopWorker> = try {
        val request = UpdateWorkerRequest(active = active)
        val response = api.updateShopWorker(workerUserId, request)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!.worker ?: throw Exception("Worker not returned"))
        } else {
            Result.Error(response.message() ?: "Failed to toggle worker status")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    // ─── Reviews ────────────────────────────────────────────────────────────────
    
    suspend fun replyToReview(
        reviewId: Int,
        reply: String
    ): Result<ShopReview> = try {
        val request = ReviewReplyRequest(reply)
        val response = api.replyToProductReview(reviewId, request)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to reply to review")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    // ─── Shop Profile ───────────────────────────────────────────────────────────
    
    suspend fun getShopProfile(): Result<ShopProfile> = try {
        val response = api.getCurrentShopProfile()
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to fetch shop profile")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun updateShopProfile(
        userId: Int,
        request: UpdateShopProfileRequest
    ): Result<ShopProfile> {
        return try {
            val updateResponse = api.updateShopProfile(userId, request)
            if (!updateResponse.isSuccessful) {
                return Result.Error(updateResponse.message() ?: "Failed to update shop profile")
            }
            val refreshed = api.getCurrentShopProfile()
            if (refreshed.isSuccessful && refreshed.body() != null) {
                Result.Success(refreshed.body()!!)
            } else {
                Result.Error(refreshed.message() ?: "Failed to refresh shop profile")
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
    
    // ─── Pay-Later Whitelist ────────────────────────────────────────────────────
    
    suspend fun getPayLaterWhitelist(): Result<PayLaterWhitelistResponse> = try {
        val response = api.getPayLaterWhitelist()
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to fetch pay-later whitelist")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun addToPayLaterWhitelist(phone: String): Result<Unit> = try {
        val request = AddToPayLaterRequest(phone)
        val response = api.addToPayLaterWhitelist(request)
        if (response.isSuccessful) {
            Result.Success(Unit)
        } else {
            Result.Error(response.message() ?: "Failed to add to pay-later whitelist")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun removeFromPayLaterWhitelist(customerId: Int): Result<Unit> = try {
        val response = api.removeFromPayLaterWhitelist(customerId)
        if (response.isSuccessful) {
            Result.Success(Unit)
        } else {
            Result.Error(response.message() ?: "Failed to remove from pay-later whitelist")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }

    // ─── Returns ───────────────────────────────────────────────────────────────
    
    suspend fun getReturnRequests(): Result<List<ReturnRequest>> = try {
        val response = api.getShopReturnRequests()
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to fetch return requests")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun approveReturnRequest(returnId: Int, comments: String? = null): Result<ReturnRequest> = try {
        val body = comments?.let { mapOf("comments" to it) }
        val response = api.approveReturnRequest(returnId, body)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to approve return request")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun rejectReturnRequest(returnId: Int, comments: String? = null): Result<ReturnRequest> = try {
        val body = comments?.let { mapOf("comments" to it) }
        val response = api.rejectReturnRequest(returnId, body)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to reject return request")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }

    // ─── Shop Order Actions ────────────────────────────────────────────────────
    
    suspend fun confirmPayment(orderId: Int): Result<ShopOrder> = try {
        val response = api.confirmShopPayment(orderId)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to confirm payment")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun approvePayLater(orderId: Int): Result<ShopOrder> = try {
        val response = api.approvePayLater(orderId)
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to approve pay-later")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
    
    suspend fun quoteTextOrder(orderId: Int, total: String): Result<ShopOrder> = try {
        val response = api.quoteTextOrder(orderId, mapOf("total" to total))
        if (response.isSuccessful && response.body() != null) {
            Result.Success(response.body()!!)
        } else {
            Result.Error(response.message() ?: "Failed to send quote")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }

    // ─── Account ──────────────────────────────────────────────────────────────

    suspend fun deleteAccount(): Result<Unit> = try {
        val response = api.deleteAccount()
        if (response.isSuccessful) {
            Result.Success(Unit)
        } else {
            Result.Error(response.message() ?: "Failed to delete account")
        }
    } catch (e: Exception) {
        Result.Error(e.message ?: "Network error")
    }
}

/**
 * Result wrapper for repository operations
 */
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String) : Result<Nothing>()
}
