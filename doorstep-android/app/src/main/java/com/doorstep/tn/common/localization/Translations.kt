package com.doorstep.tn.common.localization

/**
 * Translations for the app - English and Tamil
 */
object Translations {
    
    data class Strings(
        // Auth
        val enterPhone: String,
        val phonePlaceholder: String,
        val getOtp: String,
        val enterOtp: String,
        val verify: String,
        val enterPin: String,
        val createPin: String,
        val confirmPin: String,
        val forgotPin: String,
        val login: String,
        val next: String,
        val back: String,
        val yourName: String,
        val chooseRole: String,
        val customer: String,
        val customerDesc: String,
        val shopOwner: String,
        val shopDesc: String,
        val provider: String,
        val providerDesc: String,
        val welcome: String,
        val complete: String,
        val switchLang: String,
        val tagline: String,
        
        // Common
        val search: String,
        val cancel: String,
        val save: String,
        val delete: String,
        val loading: String,
        val error: String,
        val retry: String,
        val noData: String,
        
        // Customer
        val browseProducts: String,
        val browseServices: String,
        val myCart: String,
        val myOrders: String,
        val myBookings: String,
        val viewAll: String,
        val addToCart: String,
        val bookNow: String,
        val checkout: String,
        
        // Shop
        val dashboard: String,
        val products: String,
        val orders: String,
        val workers: String,
        val promotions: String,
        val inventory: String,
        
        // Provider
        val services: String,
        val bookings: String,
        val earnings: String,
        val availability: String,
        
        // Profile
        val profile: String,
        val logout: String,
        val settings: String,
        
        // Forgot PIN
        val resetPin: String,
        val enterPhoneToReset: String,
        val sendOtp: String,
        val verifyOtp: String,
        val resendOtp: String,
        val newPin: String,
        val otpSentTo: String,
        val createNewPin: String,
        val pinResetSuccess: String,
        val pinResetSuccessMessage: String,
        val backToLogin: String,
        val phoneNumber: String
    )
    
    val en = Strings(
        // Auth
        enterPhone = "Enter your mobile number",
        phonePlaceholder = "9876543210",
        getOtp = "Continue",
        enterOtp = "Enter OTP",
        verify = "Verify",
        enterPin = "Enter your PIN",
        createPin = "Create a 4-digit PIN",
        confirmPin = "Confirm PIN",
        forgotPin = "Forgot PIN?",
        login = "Login",
        next = "Next",
        back = "Back",
        yourName = "Your Name",
        chooseRole = "How will you use the app?",
        customer = "Customer",
        customerDesc = "Book services & shop products",
        shopOwner = "Shop Owner",
        shopDesc = "Sell your products",
        provider = "Service Provider",
        providerDesc = "Offer your services",
        welcome = "Welcome!",
        complete = "Complete Setup",
        switchLang = "தமிழ்",
        tagline = "Your local services, delivered",
        
        // Common
        search = "Search",
        cancel = "Cancel",
        save = "Save",
        delete = "Delete",
        loading = "Loading...",
        error = "Error",
        retry = "Retry",
        noData = "No data available",
        
        // Customer
        browseProducts = "Browse Products",
        browseServices = "Browse Services",
        myCart = "My Cart",
        myOrders = "My Orders",
        myBookings = "My Bookings",
        viewAll = "View All",
        addToCart = "Add to Cart",
        bookNow = "Book Now",
        checkout = "Checkout",
        
        // Shop
        dashboard = "Dashboard",
        products = "Products",
        orders = "Orders",
        workers = "Workers",
        promotions = "Promotions",
        inventory = "Inventory",
        
        // Provider
        services = "Services",
        bookings = "Bookings",
        earnings = "Earnings",
        availability = "Availability",
        
        // Profile
        profile = "Profile",
        logout = "Logout",
        settings = "Settings",
        
        // Forgot PIN
        resetPin = "Reset PIN",
        enterPhoneToReset = "Enter your phone to reset PIN",
        sendOtp = "Send OTP",
        verifyOtp = "Verify OTP",
        resendOtp = "Resend OTP",
        newPin = "New PIN",
        otpSentTo = "OTP sent to",
        createNewPin = "Create a new secure PIN",
        pinResetSuccess = "PIN Reset!",
        pinResetSuccessMessage = "Your PIN has been reset successfully. You can now login with your new PIN.",
        backToLogin = "Back to Login",
        phoneNumber = "Phone Number"
    )
    
    val ta = Strings(
        // Auth
        enterPhone = "உங்கள் மொபைல் எண்",
        phonePlaceholder = "9876543210",
        getOtp = "தொடரவும்",
        enterOtp = "OTP உள்ளிடுக",
        verify = "சரிபார்க்கவும்",
        enterPin = "உங்கள் PIN",
        createPin = "4 இலக்க PIN உருவாக்கவும்",
        confirmPin = "PIN உறுதிப்படுத்தவும்",
        forgotPin = "PIN மறந்துவிட்டதா?",
        login = "உள்நுழை",
        next = "அடுத்து",
        back = "பின்",
        yourName = "உங்கள் பெயர்",
        chooseRole = "நீங்கள் யார்?",
        customer = "வாடிக்கையாளர்",
        customerDesc = "சேவைகளை முன்பதிவு செய்க",
        shopOwner = "கடை உரிமையாளர்",
        shopDesc = "பொருட்களை விற்கவும்",
        provider = "சேவை வழங்குநர்",
        providerDesc = "சேவைகளை வழங்கவும்",
        welcome = "வரவேற்பு!",
        complete = "அமைப்பை முடிக்கவும்",
        switchLang = "English",
        tagline = "உங்கள் உள்ளூர் சேவைகள்",
        
        // Common
        search = "தேடு",
        cancel = "ரத்து செய்",
        save = "சேமி",
        delete = "நீக்கு",
        loading = "ஏற்றுகிறது...",
        error = "பிழை",
        retry = "மீண்டும் முயற்சி",
        noData = "தரவு இல்லை",
        
        // Customer
        browseProducts = "பொருட்களை பார்க்க",
        browseServices = "சேவைகளை பார்க்க",
        myCart = "என் கார்ட்",
        myOrders = "என் ஆர்டர்கள்",
        myBookings = "என் முன்பதிவுகள்",
        viewAll = "அனைத்தும் பார்க்க",
        addToCart = "கார்ட்டில் சேர்",
        bookNow = "இப்போது புக் செய்",
        checkout = "செக்அவுட்",
        
        // Shop
        dashboard = "டாஷ்போர்டு",
        products = "பொருட்கள்",
        orders = "ஆர்டர்கள்",
        workers = "ஊழியர்கள்",
        promotions = "தள்ளுபடிகள்",
        inventory = "சரக்கு",
        
        // Provider
        services = "சேவைகள்",
        bookings = "முன்பதிவுகள்",
        earnings = "வருமானம்",
        availability = "கிடைக்கும் நேரம்",
        
        // Profile
        profile = "சுயவிவரம்",
        logout = "வெளியேறு",
        settings = "அமைப்புகள்",
        
        // Forgot PIN
        resetPin = "PIN மீட்டமை",
        enterPhoneToReset = "PIN மீட்டமைக்க உங்கள் மொபைல் எண்",
        sendOtp = "OTP அனுப்பு",
        verifyOtp = "OTP சரிபார்",
        resendOtp = "OTP மீண்டும் அனுப்பு",
        newPin = "புதிய PIN",
        otpSentTo = "OTP அனுப்பப்பட்டது",
        createNewPin = "புதிய பாதுகாப்பான PIN உருவாக்கு",
        pinResetSuccess = "PIN மீட்டமைக்கப்பட்டது!",
        pinResetSuccessMessage = "உங்கள் PIN வெற்றிகரமாக மீட்டமைக்கப்பட்டது. புதிய PIN உடன் உள்நுழையலாம்.",
        backToLogin = "உள்நுழைவுக்கு திரும்பு",
        phoneNumber = "மொபைல் எண்"
    )
    
    fun get(language: String): Strings {
        return if (language == "ta") ta else en
    }
}
