package com.doorstep.tn.customer.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class Product(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "description") val description: String,
    @Json(name = "price") val price: String,
    @Json(name = "mrp") val mrp: String,
    @Json(name = "stock") val stock: Int? = null,
    @Json(name = "category") val category: String,
    @Json(name = "images") val images: List<String>? = null,
    @Json(name = "isAvailable") val isAvailable: Boolean = true,
    @Json(name = "shopId") val shopId: Int? = null
)

@JsonClass(generateAdapter = true)
data class Service(
    @Json(name = "id") val id: Int,
    @Json(name = "name") val name: String,
    @Json(name = "description") val description: String,
    @Json(name = "price") val price: String,
    @Json(name = "duration") val duration: Int,
    @Json(name = "category") val category: String,
    @Json(name = "images") val images: List<String>? = null,
    @Json(name = "isAvailable") val isAvailable: Boolean = true,
    @Json(name = "providerId") val providerId: Int? = null,
    @Json(name = "isAvailableNow") val isAvailableNow: Boolean = true
)

@JsonClass(generateAdapter = true)
data class Order(
    @Json(name = "id") val id: Int,
    @Json(name = "customerId") val customerId: Int? = null,
    @Json(name = "shopId") val shopId: Int? = null,
    @Json(name = "status") val status: String,
    @Json(name = "total") val total: String,
    @Json(name = "orderDate") val orderDate: String? = null,
    @Json(name = "shippingAddress") val shippingAddress: String? = null,
    @Json(name = "paymentMethod") val paymentMethod: String? = null,
    @Json(name = "items") val items: List<OrderItem>? = null
)

@JsonClass(generateAdapter = true)
data class OrderItem(
    @Json(name = "id") val id: Int,
    @Json(name = "productId") val productId: Int? = null,
    @Json(name = "quantity") val quantity: Int,
    @Json(name = "price") val price: String,
    @Json(name = "total") val total: String,
    @Json(name = "product") val product: Product? = null
)

@JsonClass(generateAdapter = true)
data class Booking(
    @Json(name = "id") val id: Int,
    @Json(name = "customerId") val customerId: Int? = null,
    @Json(name = "serviceId") val serviceId: Int? = null,
    @Json(name = "status") val status: String,
    @Json(name = "bookingDate") val bookingDate: String? = null,
    @Json(name = "timeSlotLabel") val timeSlotLabel: String? = null,
    @Json(name = "service") val service: Service? = null
)

@JsonClass(generateAdapter = true)
data class CartItem(
    @Json(name = "id") val id: Int? = null,
    @Json(name = "productId") val productId: Int,
    @Json(name = "quantity") val quantity: Int,
    @Json(name = "product") val product: Product? = null
)
