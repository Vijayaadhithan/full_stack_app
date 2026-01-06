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
import com.doorstep.tn.customer.ui.services.ServicesListScreen
import com.doorstep.tn.customer.ui.orders.OrdersListScreen
import com.doorstep.tn.customer.ui.bookings.BookingsListScreen
import com.doorstep.tn.customer.ui.cart.CartScreen
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
    const val CUSTOMER_PRODUCT_DETAIL = "customer_product/{productId}"
    const val CUSTOMER_SERVICES = "customer_services"
    const val CUSTOMER_SERVICE_DETAIL = "customer_service/{serviceId}"
    const val CUSTOMER_CART = "customer_cart"
    const val CUSTOMER_CHECKOUT = "customer_checkout"
    const val CUSTOMER_ORDERS = "customer_orders"
    const val CUSTOMER_ORDER_DETAIL = "customer_order/{orderId}"
    const val CUSTOMER_BOOKINGS = "customer_bookings"
    const val CUSTOMER_BOOKING_DETAIL = "customer_booking/{bookingId}"
    const val CUSTOMER_PROFILE = "customer_profile"
    
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
    fun productDetail(productId: Int) = "customer_product/$productId"
    fun serviceDetail(serviceId: Int) = "customer_service/$serviceId"
    fun orderDetail(orderId: Int) = "customer_order/$orderId"
    fun bookingDetail(bookingId: Int) = "customer_booking/$bookingId"
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
                onNavigateToCart = { navController.navigate(Routes.CUSTOMER_CART) },
                onNavigateToOrders = { navController.navigate(Routes.CUSTOMER_ORDERS) },
                onNavigateToBookings = { navController.navigate(Routes.CUSTOMER_BOOKINGS) },
                onNavigateToProfile = { navController.navigate(Routes.CUSTOMER_PROFILE) },
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
                onNavigateToProduct = { productId -> 
                    navController.navigate(Routes.productDetail(productId))
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
                onCheckout = { navController.navigate(Routes.CUSTOMER_CHECKOUT) }
            )
        }
        
        composable(Routes.CUSTOMER_ORDERS) {
            OrdersListScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToOrder = { orderId ->
                    navController.navigate(Routes.orderDetail(orderId))
                }
            )
        }
        
        composable(Routes.CUSTOMER_BOOKINGS) {
            BookingsListScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToBooking = { bookingId ->
                    navController.navigate(Routes.bookingDetail(bookingId))
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
