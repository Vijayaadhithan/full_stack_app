package com.doorstep.tn.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.doorstep.tn.auth.ui.AuthViewModel
import com.doorstep.tn.auth.ui.PhoneEntryScreen
import com.doorstep.tn.auth.ui.OtpVerifyScreen
import com.doorstep.tn.auth.ui.PinEntryScreen
import com.doorstep.tn.auth.ui.ProfileSetupScreen
import com.doorstep.tn.auth.ui.PinSetupScreen
import com.doorstep.tn.auth.ui.ForgotPinScreen
import com.doorstep.tn.customer.ui.CustomerHomeScreen
import com.doorstep.tn.customer.ui.products.ProductsListScreen
import com.doorstep.tn.customer.ui.products.ProductDetailScreen
import com.doorstep.tn.customer.ui.services.ServicesListScreen
import com.doorstep.tn.customer.ui.services.ServiceDetailScreen
import com.doorstep.tn.customer.ui.orders.OrdersListScreen
import com.doorstep.tn.customer.ui.orders.OrderDetailScreen
import com.doorstep.tn.customer.ui.bookings.BookingsListScreen
import com.doorstep.tn.customer.ui.bookings.BookingDetailScreen
import com.doorstep.tn.customer.ui.bookings.BookServiceScreen
import com.doorstep.tn.customer.ui.cart.CartScreen
import com.doorstep.tn.customer.ui.wishlist.WishlistScreen
import com.doorstep.tn.customer.ui.shops.ShopsListScreen
import com.doorstep.tn.customer.ui.shops.ShopDetailScreen
import com.doorstep.tn.customer.ui.profile.ProfileScreen
import com.doorstep.tn.customer.ui.reviews.MyReviewsScreen
import com.doorstep.tn.customer.ui.notifications.NotificationsScreen
import com.doorstep.tn.customer.ui.search.UniversalSearchScreen
import com.doorstep.tn.customer.ui.quickorder.QuickOrderScreen
import com.doorstep.tn.shop.ui.ShopDashboardScreen
import com.doorstep.tn.provider.ui.ProviderDashboardScreen

/**
 * Navigation routes for the app
 */
object Routes {
    // Auth routes
    const val PHONE_ENTRY = "phone_entry"
    const val OTP_VERIFY = "otp_verify"
    const val PIN_ENTRY = "pin_entry"
    const val PROFILE_SETUP = "profile_setup"
    const val PIN_SETUP = "pin_setup"
    const val FORGOT_PIN = "forgot_pin"
    
    // Customer routes
    const val CUSTOMER_HOME = "customer_home"
    const val CUSTOMER_PRODUCTS = "customer_products"
    // Match web: /customer/shops/{shopId}/products/{productId}
    const val CUSTOMER_PRODUCT_DETAIL = "customer_shop/{shopId}/product/{productId}"
    const val CUSTOMER_SERVICES = "customer_services"
    const val CUSTOMER_SERVICE_DETAIL = "customer_service/{serviceId}"
    const val CUSTOMER_CART = "customer_cart"
    const val CUSTOMER_CHECKOUT = "customer_checkout"
    const val CUSTOMER_ORDERS = "customer_orders"
    const val CUSTOMER_ORDER_DETAIL = "customer_order/{orderId}"
    const val CUSTOMER_BOOKINGS = "customer_bookings"
    const val CUSTOMER_BOOKING_DETAIL = "customer_booking/{bookingId}"
    const val CUSTOMER_SHOPS = "customer_shops"
    const val CUSTOMER_SHOP_DETAIL = "customer_shop/{shopId}"
    const val CUSTOMER_PROFILE = "customer_profile"
    const val CUSTOMER_WISHLIST = "customer_wishlist"
    const val CUSTOMER_BOOK_SERVICE = "customer_book_service/{serviceId}"
    const val CUSTOMER_REVIEWS = "customer_reviews"
    const val CUSTOMER_NOTIFICATIONS = "customer_notifications"
    const val CUSTOMER_SEARCH = "customer_search"
    const val CUSTOMER_QUICK_ORDER = "customer_quick_order/{shopId}/{shopName}"
    
    // Route builders with parameters
    fun quickOrder(shopId: Int, shopName: String): String = 
        "customer_quick_order/$shopId/${java.net.URLEncoder.encode(shopName, "UTF-8")}"
    
    // Shop routes
    const val SHOP_DASHBOARD = "shop_dashboard"
    const val SHOP_PRODUCTS = "shop_products"
    const val SHOP_PRODUCT_EDIT = "shop_product_edit/{productId}"
    const val SHOP_PRODUCT_ADD = "shop_product_add"
    const val SHOP_ORDERS = "shop_orders"
    const val SHOP_ORDER_DETAIL = "shop_order/{orderId}"
    const val SHOP_WORKERS = "shop_workers"
    const val SHOP_PROMOTIONS = "shop_promotions"
    const val SHOP_PROFILE = "shop_profile"
    
    // Provider routes
    const val PROVIDER_DASHBOARD = "provider_dashboard"
    const val PROVIDER_SERVICES = "provider_services"
    const val PROVIDER_SERVICE_EDIT = "provider_service_edit/{serviceId}"
    const val PROVIDER_SERVICE_ADD = "provider_service_add"
    const val PROVIDER_BOOKINGS = "provider_bookings"
    const val PROVIDER_BOOKING_DETAIL = "provider_booking/{bookingId}"
    const val PROVIDER_EARNINGS = "provider_earnings"
    const val PROVIDER_PROFILE = "provider_profile"
    
    // Helper functions
    fun productDetail(shopId: Int, productId: Int) = "customer_shop/$shopId/product/$productId"
    fun serviceDetail(serviceId: Int) = "customer_service/$serviceId"
    fun orderDetail(orderId: Int) = "customer_order/$orderId"
    fun bookingDetail(bookingId: Int) = "customer_booking/$bookingId"
    fun shopDetail(shopId: Int) = "customer_shop/$shopId"
    fun bookService(serviceId: Int) = "customer_book_service/$serviceId"
}

/**
 * Main navigation host for the app
 */
@Composable
fun DoorStepNavHost(
    navController: NavHostController = rememberNavController(),
    authViewModel: AuthViewModel = hiltViewModel()
) {
    val isLoggedIn by authViewModel.isLoggedIn.collectAsState()
    val userRole by authViewModel.userRole.collectAsState()
    
    val startDestination = if (isLoggedIn) {
        when (userRole) {
            "shop" -> Routes.SHOP_DASHBOARD
            "provider" -> Routes.PROVIDER_DASHBOARD
            "worker" -> Routes.SHOP_DASHBOARD
            else -> Routes.CUSTOMER_HOME
        }
    } else {
        Routes.PHONE_ENTRY
    }
    
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        // ==================== AUTH ROUTES ====================
        composable(Routes.PHONE_ENTRY) {
            PhoneEntryScreen(
                viewModel = authViewModel,
                onNavigateToPin = { navController.navigate(Routes.PIN_ENTRY) },
                onNavigateToOtp = { navController.navigate(Routes.OTP_VERIFY) }
            )
        }
        
        composable(Routes.OTP_VERIFY) {
            OtpVerifyScreen(
                viewModel = authViewModel,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToProfileSetup = { navController.navigate(Routes.PROFILE_SETUP) }
            )
        }
        
        composable(Routes.PIN_ENTRY) {
            PinEntryScreen(
                viewModel = authViewModel,
                onNavigateBack = { navController.popBackStack() },
                onLoginSuccess = { role ->
                    val destination = when (role) {
                        "shop" -> Routes.SHOP_DASHBOARD
                        "provider" -> Routes.PROVIDER_DASHBOARD
                        "worker" -> Routes.SHOP_DASHBOARD
                        else -> Routes.CUSTOMER_HOME
                    }
                    navController.navigate(destination) {
                        popUpTo(Routes.PHONE_ENTRY) { inclusive = true }
                    }
                },
                onForgotPin = { navController.navigate(Routes.FORGOT_PIN) }
            )
        }
        
        composable(Routes.FORGOT_PIN) {
            ForgotPinScreen(
                viewModel = authViewModel,
                onNavigateBack = { navController.popBackStack() },
                onPinResetSuccess = {
                    navController.navigate(Routes.PHONE_ENTRY) {
                        popUpTo(Routes.PHONE_ENTRY) { inclusive = true }
                    }
                }
            )
        }
        
        composable(Routes.PROFILE_SETUP) {
            ProfileSetupScreen(
                viewModel = authViewModel,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToPinSetup = { navController.navigate(Routes.PIN_SETUP) }
            )
        }
        
        composable(Routes.PIN_SETUP) {
            PinSetupScreen(
                viewModel = authViewModel,
                onNavigateBack = { navController.popBackStack() },
                onRegistrationSuccess = { role ->
                    val destination = when (role) {
                        "shop" -> Routes.SHOP_DASHBOARD
                        "provider" -> Routes.PROVIDER_DASHBOARD
                        else -> Routes.CUSTOMER_HOME
                    }
                    navController.navigate(destination) {
                        popUpTo(Routes.PHONE_ENTRY) { inclusive = true }
                    }
                }
            )
        }
        
        // ==================== CUSTOMER ROUTES ====================
        composable(Routes.CUSTOMER_HOME) {
            CustomerHomeScreen(
                onNavigateToProducts = { navController.navigate(Routes.CUSTOMER_PRODUCTS) },
                onNavigateToServices = { navController.navigate(Routes.CUSTOMER_SERVICES) },
                onNavigateToShops = { navController.navigate(Routes.CUSTOMER_SHOPS) },
                onNavigateToCart = { navController.navigate(Routes.CUSTOMER_CART) },
                onNavigateToWishlist = { navController.navigate(Routes.CUSTOMER_WISHLIST) },
                onNavigateToOrders = { navController.navigate(Routes.CUSTOMER_ORDERS) },
                onNavigateToBookings = { navController.navigate(Routes.CUSTOMER_BOOKINGS) },
                onNavigateToProfile = { navController.navigate(Routes.CUSTOMER_PROFILE) },
                onNavigateToSearch = { navController.navigate(Routes.CUSTOMER_SEARCH) },
                onNavigateToNotifications = { navController.navigate(Routes.CUSTOMER_NOTIFICATIONS) },
                onLogout = {
                    authViewModel.logout()
                    navController.navigate(Routes.PHONE_ENTRY) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
        
        composable(Routes.CUSTOMER_PRODUCTS) {
            ProductsListScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToProduct = { shopId, productId -> 
                    navController.navigate(Routes.productDetail(shopId, productId))
                },
                onNavigateToCart = { navController.navigate(Routes.CUSTOMER_CART) }
            )
        }
        
        composable(Routes.CUSTOMER_SERVICES) {
            ServicesListScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToService = { serviceId ->
                    navController.navigate(Routes.serviceDetail(serviceId))
                }
            )
        }
        
        composable(Routes.CUSTOMER_CART) {
            CartScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToProducts = { navController.navigate(Routes.CUSTOMER_PRODUCTS) },
                onOrderComplete = { 
                    // Navigate to orders list after successful order
                    navController.navigate(Routes.CUSTOMER_ORDERS) {
                        popUpTo(Routes.CUSTOMER_CART) { inclusive = true }
                    }
                }
            )
        }
        
        composable(Routes.CUSTOMER_SHOPS) {
            ShopsListScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToShop = { shopId ->
                    navController.navigate(Routes.shopDetail(shopId))
                }
            )
        }
        
        composable(Routes.CUSTOMER_ORDERS) {
            OrdersListScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToOrder = { orderId ->
                    navController.navigate(Routes.orderDetail(orderId))
                },
                onNavigateToShops = { navController.navigate(Routes.CUSTOMER_SHOPS) }
            )
        }
        
        // Order Detail Screen
        composable(
            route = Routes.CUSTOMER_ORDER_DETAIL,
            arguments = listOf(navArgument("orderId") { type = NavType.IntType })
        ) { backStackEntry ->
            val orderId = backStackEntry.arguments?.getInt("orderId") ?: 0
            OrderDetailScreen(
                orderId = orderId,
                onNavigateBack = { navController.popBackStack() }
            )
        }
        
        composable(Routes.CUSTOMER_BOOKINGS) {
            // Booking info shown inline like web - no navigation to detail page
            BookingsListScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }
        
        composable(
            route = Routes.CUSTOMER_BOOKING_DETAIL,
            arguments = listOf(navArgument("bookingId") { type = NavType.IntType })
        ) { backStackEntry ->
            val bookingId = backStackEntry.arguments?.getInt("bookingId") ?: 0
            BookingDetailScreen(
                bookingId = bookingId,
                onNavigateBack = { navController.popBackStack() }
            )
        }
        
        composable(Routes.CUSTOMER_PROFILE) {
            ProfileScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToReviews = { navController.navigate(Routes.CUSTOMER_REVIEWS) },
                onLogout = {
                    authViewModel.logout()
                    navController.navigate(Routes.PHONE_ENTRY) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
        
        composable(Routes.CUSTOMER_REVIEWS) {
            MyReviewsScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }
        
        composable(Routes.CUSTOMER_WISHLIST) {
            WishlistScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToProduct = { shopId, productId ->
                    navController.navigate(Routes.productDetail(shopId, productId))
                }
            )
        }
        
        // My Reviews Screen
        composable(Routes.CUSTOMER_REVIEWS) {
            MyReviewsScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }
        
        // Notifications Screen
        composable(Routes.CUSTOMER_NOTIFICATIONS) {
            NotificationsScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToBooking = { bookingId ->
                    navController.navigate(Routes.bookingDetail(bookingId))
                },
                onNavigateToBookings = {
                    navController.navigate(Routes.CUSTOMER_BOOKINGS)
                },
                onNavigateToOrders = {
                    navController.navigate(Routes.CUSTOMER_ORDERS)
                },
                onNavigateToOrder = { orderId ->
                    navController.navigate(Routes.orderDetail(orderId))
                }
            )
        }
        
        // Universal Search Screen
        composable(Routes.CUSTOMER_SEARCH) {
            UniversalSearchScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToService = { serviceId ->
                    navController.navigate(Routes.serviceDetail(serviceId))
                },
                onNavigateToProduct = { shopId, productId ->
                    navController.navigate(Routes.productDetail(shopId, productId))
                },
                onNavigateToShop = { shopId ->
                    navController.navigate(Routes.shopDetail(shopId))
                }
            )
        }
        
        // Quick Order Screen
        composable(
            route = Routes.CUSTOMER_QUICK_ORDER,
            arguments = listOf(
                navArgument("shopId") { type = NavType.IntType },
                navArgument("shopName") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val shopId = backStackEntry.arguments?.getInt("shopId") ?: 0
            val shopName = java.net.URLDecoder.decode(
                backStackEntry.arguments?.getString("shopName") ?: "Shop",
                "UTF-8"
            )
            QuickOrderScreen(
                shopId = shopId,
                shopName = shopName,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToOrder = { orderId ->
                    navController.navigate(Routes.orderDetail(orderId))
                }
            )
        }
        
        composable(
            route = Routes.CUSTOMER_PRODUCT_DETAIL,
            arguments = listOf(
                navArgument("shopId") { type = NavType.IntType },
                navArgument("productId") { type = NavType.IntType }
            )
        ) { backStackEntry ->
            val shopId = backStackEntry.arguments?.getInt("shopId") ?: 0
            val productId = backStackEntry.arguments?.getInt("productId") ?: 0
            ProductDetailScreen(
                shopId = shopId,
                productId = productId,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToCart = { navController.navigate(Routes.CUSTOMER_CART) }
            )
        }
        
        composable(
            route = Routes.CUSTOMER_SERVICE_DETAIL,
            arguments = listOf(navArgument("serviceId") { type = NavType.IntType })
        ) { backStackEntry ->
            val serviceId = backStackEntry.arguments?.getInt("serviceId") ?: 0
            ServiceDetailScreen(
                serviceId = serviceId,
                onNavigateBack = { navController.popBackStack() },
                onBookService = { sId -> navController.navigate(Routes.bookService(sId)) }
            )
        }
        
        composable(
            route = Routes.CUSTOMER_SHOP_DETAIL,
            arguments = listOf(navArgument("shopId") { type = NavType.IntType })
        ) { backStackEntry ->
            val shopId = backStackEntry.arguments?.getInt("shopId") ?: 0
            ShopDetailScreen(
                shopId = shopId,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToProduct = { sId, productId ->
                    navController.navigate(Routes.productDetail(sId, productId))
                },
                onNavigateToCart = { navController.navigate(Routes.CUSTOMER_CART) },
                onNavigateToQuickOrder = { sId, shopName ->
                    navController.navigate(Routes.quickOrder(sId, shopName))
                }
            )
        }
        
        // Book Service screen
        composable(
            route = Routes.CUSTOMER_BOOK_SERVICE,
            arguments = listOf(navArgument("serviceId") { type = NavType.IntType })
        ) { backStackEntry ->
            val serviceId = backStackEntry.arguments?.getInt("serviceId") ?: 0
            BookServiceScreen(
                serviceId = serviceId,
                onNavigateBack = { navController.popBackStack() },
                onBookingComplete = {
                    navController.navigate(Routes.CUSTOMER_BOOKINGS) {
                        popUpTo(Routes.CUSTOMER_HOME)
                    }
                }
            )
        }
        
        // ==================== SHOP ROUTES ====================
        composable(Routes.SHOP_DASHBOARD) {
            ShopDashboardScreen(
                onNavigateToProducts = { navController.navigate(Routes.SHOP_PRODUCTS) },
                onNavigateToOrders = { navController.navigate(Routes.SHOP_ORDERS) },
                onNavigateToWorkers = { navController.navigate(Routes.SHOP_WORKERS) },
                onNavigateToPromotions = { navController.navigate(Routes.SHOP_PROMOTIONS) },
                onNavigateToProfile = { navController.navigate(Routes.SHOP_PROFILE) },
                onLogout = {
                    authViewModel.logout()
                    navController.navigate(Routes.PHONE_ENTRY) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
        
        // ==================== PROVIDER ROUTES ====================
        composable(Routes.PROVIDER_DASHBOARD) {
            ProviderDashboardScreen(
                onNavigateToServices = { navController.navigate(Routes.PROVIDER_SERVICES) },
                onNavigateToBookings = { navController.navigate(Routes.PROVIDER_BOOKINGS) },
                onNavigateToEarnings = { navController.navigate(Routes.PROVIDER_EARNINGS) },
                onNavigateToProfile = { navController.navigate(Routes.PROVIDER_PROFILE) },
                onLogout = {
                    authViewModel.logout()
                    navController.navigate(Routes.PHONE_ENTRY) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
    }
}
