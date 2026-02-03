package com.doorstep.tn.common.config

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Checkroom
import androidx.compose.material.icons.filled.Devices
import androidx.compose.material.icons.filled.ElectricalServices
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Handyman
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Plumbing
import androidx.compose.material.icons.filled.TwoWheeler
import androidx.compose.ui.graphics.vector.ImageVector
import java.util.Locale

data class CategoryOption(
    val value: String,
    val label: String
)

data class ServiceCategoryOption(
    val value: String,
    val label: String,
    val icon: ImageVector
)

val PRODUCT_CATEGORIES: List<CategoryOption> = listOf(
    CategoryOption("groceries", "Groceries"),
    CategoryOption("vegetables", "Vegetables"),
    CategoryOption("fruits", "Fruits"),
    CategoryOption("dairy", "Dairy Products"),
    CategoryOption("rice_grains", "Rice & Grains"),
    CategoryOption("spices", "Spices & Masala"),
    CategoryOption("oil_ghee", "Oil & Ghee"),
    CategoryOption("snacks_bakery", "Snacks & Bakery"),
    CategoryOption("hardware", "Hardware"),
    CategoryOption("cement_sand", "Cement & Sand"),
    CategoryOption("pipes_fittings", "Pipes & Fittings"),
    CategoryOption("paint", "Paints"),
    CategoryOption("agriculture", "Agriculture"),
    CategoryOption("seeds", "Seeds"),
    CategoryOption("fertilizers", "Fertilizers"),
    CategoryOption("pesticides", "Pesticides"),
    CategoryOption("farm_tools", "Farm Tools"),
    CategoryOption("textiles", "Textiles"),
    CategoryOption("sarees", "Sarees"),
    CategoryOption("readymade", "Readymade Clothes"),
    CategoryOption("electronics", "Electronics"),
    CategoryOption("electrical", "Electrical Items"),
    CategoryOption("mobile", "Mobile & Accessories"),
    CategoryOption("fans_lights", "Fans & Lights"),
    CategoryOption("vessel_utensils", "Vessels & Utensils"),
    CategoryOption("plastic_items", "Plastic Items"),
    CategoryOption("furniture", "Furniture"),
    CategoryOption("home_decor", "Home Decor"),
    CategoryOption("pharmacy", "Pharmacy"),
    CategoryOption("beauty", "Beauty & Personal Care"),
    CategoryOption("stationery", "Stationery"),
    CategoryOption("books", "Books"),
    CategoryOption("toys", "Toys"),
    CategoryOption("puja_items", "Puja Items"),
    CategoryOption("bicycle_parts", "Bicycle & Parts"),
    CategoryOption("general", "General Store"),
    CategoryOption("other_product", "Other")
)

val SERVICE_CATEGORIES: List<ServiceCategoryOption> = listOf(
    ServiceCategoryOption("all", "All", Icons.Default.Apps),
    ServiceCategoryOption("plumbing", "Plumbing", Icons.Default.Plumbing),
    ServiceCategoryOption("electrical_work", "Electrical Work", Icons.Default.ElectricalServices),
    ServiceCategoryOption("carpentry", "Carpentry", Icons.Default.Handyman),
    ServiceCategoryOption("masonry", "Masonry", Icons.Default.Build),
    ServiceCategoryOption("painting", "Painting", Icons.Default.Build),
    ServiceCategoryOption("welding", "Welding", Icons.Default.Build),
    ServiceCategoryOption("tiling", "Tiling & Flooring", Icons.Default.Build),
    ServiceCategoryOption("beauty_salon", "Beauty Salon", Icons.Default.Face),
    ServiceCategoryOption("barbershop", "Barbershop", Icons.Default.Face),
    ServiceCategoryOption("mehendi", "Mehendi", Icons.Default.Face),
    ServiceCategoryOption("tailoring", "Tailoring", Icons.Default.Checkroom),
    ServiceCategoryOption("embroidery", "Embroidery", Icons.Default.Checkroom),
    ServiceCategoryOption("motor_repair", "Two-Wheeler Repair", Icons.Default.TwoWheeler),
    ServiceCategoryOption("auto_repair", "Auto Repair", Icons.Default.TwoWheeler),
    ServiceCategoryOption("car_service", "Car Service", Icons.Default.Build),
    ServiceCategoryOption("tyre_puncture", "Tyre & Puncture", Icons.Default.Build),
    ServiceCategoryOption("mobile_repair", "Mobile Repair", Icons.Default.Devices),
    ServiceCategoryOption("appliance_repair", "Appliance Repair", Icons.Default.Devices),
    ServiceCategoryOption("computer_repair", "Computer Repair", Icons.Default.Devices),
    ServiceCategoryOption("cleaning", "Cleaning", Icons.Default.Home),
    ServiceCategoryOption("pest_control", "Pest Control", Icons.Default.Build),
    ServiceCategoryOption("laundry", "Laundry", Icons.Default.Build),
    ServiceCategoryOption("water_tank_cleaning", "Water Tank Cleaning", Icons.Default.Build),
    ServiceCategoryOption("tutoring", "Tutoring", Icons.Default.Build),
    ServiceCategoryOption("driving_lessons", "Driving Lessons", Icons.Default.Build),
    ServiceCategoryOption("typing_center", "Typing Center", Icons.Default.Build),
    ServiceCategoryOption("photography", "Photography", Icons.Default.Build),
    ServiceCategoryOption("videography", "Videography", Icons.Default.Build),
    ServiceCategoryOption("catering", "Catering", Icons.Default.Build),
    ServiceCategoryOption("tent_pandal", "Tent & Pandal", Icons.Default.Build),
    ServiceCategoryOption("decoration", "Decoration", Icons.Default.Build),
    ServiceCategoryOption("music_band", "Music & Band", Icons.Default.Build),
    ServiceCategoryOption("priest_services", "Priest Services", Icons.Default.Build),
    ServiceCategoryOption("astrology", "Astrology", Icons.Default.Build),
    ServiceCategoryOption("nursing", "Home Nursing", Icons.Default.Build),
    ServiceCategoryOption("physiotherapy", "Physiotherapy", Icons.Default.Build),
    ServiceCategoryOption("courier", "Courier & Delivery", Icons.Default.LocalShipping),
    ServiceCategoryOption("driver", "Driver", Icons.Default.TwoWheeler),
    ServiceCategoryOption("other_service", "Other Services", Icons.Default.Build)
)

private val PRODUCT_CATEGORY_VALUE_MAP = PRODUCT_CATEGORIES.associateBy {
    it.value.lowercase(Locale.ROOT)
}
private val PRODUCT_CATEGORY_LABEL_MAP = PRODUCT_CATEGORIES.associateBy {
    it.label.lowercase(Locale.ROOT)
}
private val SERVICE_CATEGORY_VALUE_MAP = SERVICE_CATEGORIES.associateBy {
    it.value.lowercase(Locale.ROOT)
}
private val SERVICE_CATEGORY_LABEL_MAP = SERVICE_CATEGORIES.associateBy {
    it.label.lowercase(Locale.ROOT)
}

fun productCategoryLabel(value: String?): String {
    if (value.isNullOrBlank()) return ""
    val trimmed = value.trim()
    val normalized = trimmed.lowercase(Locale.ROOT)
    return PRODUCT_CATEGORY_VALUE_MAP[normalized]?.label
        ?: PRODUCT_CATEGORY_LABEL_MAP[normalized]?.label
        ?: trimmed
}

fun serviceCategoryLabel(value: String?): String {
    if (value.isNullOrBlank()) return ""
    val trimmed = value.trim()
    val normalized = trimmed.lowercase(Locale.ROOT)
    return SERVICE_CATEGORY_VALUE_MAP[normalized]?.label
        ?: SERVICE_CATEGORY_LABEL_MAP[normalized]?.label
        ?: trimmed
}

fun serviceCategoryIcon(value: String?): ImageVector {
    if (value.isNullOrBlank()) return Icons.Default.Build
    val normalized = value.trim().lowercase(Locale.ROOT)
    return SERVICE_CATEGORY_VALUE_MAP[normalized]?.icon ?: Icons.Default.Build
}
