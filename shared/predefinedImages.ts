/**
 * Predefined Images System for Products, Services, and Shops
 * 
 * Uses inline SVG icons with gradient backgrounds for:
 * - Zero network latency (no image downloads)
 * - Minimal memory footprint
 * - Crisp rendering at any size
 * - Fast initial paint
 */

// ============================================================================
// Product Category Icons - Rural Tamil Nadu Focus
// ============================================================================

export interface CategoryImage {
    id: string;
    label: string;
    labelTamil: string;
    /** Lucide icon name to use */
    icon: string;
    /** Gradient colors [from, to] */
    gradient: [string, string];
    /** Optional pattern overlay */
    pattern?: 'dots' | 'lines' | 'grid';
}

export const productCategoryImages: Record<string, CategoryImage> = {
    // Groceries & Food
    groceries: {
        id: 'groceries',
        label: 'Groceries',
        labelTamil: 'மளிகை சாமான்கள்',
        icon: 'ShoppingBasket',
        gradient: ['#22c55e', '#16a34a'],
    },
    vegetables: {
        id: 'vegetables',
        label: 'Vegetables',
        labelTamil: 'காய்கறிகள்',
        icon: 'Carrot',
        gradient: ['#84cc16', '#65a30d'],
    },
    fruits: {
        id: 'fruits',
        label: 'Fruits',
        labelTamil: 'பழங்கள்',
        icon: 'Apple',
        gradient: ['#f97316', '#ea580c'],
    },
    dairy: {
        id: 'dairy',
        label: 'Dairy Products',
        labelTamil: 'பால் பொருட்கள்',
        icon: 'Milk',
        gradient: ['#60a5fa', '#3b82f6'],
    },
    rice_grains: {
        id: 'rice_grains',
        label: 'Rice & Grains',
        labelTamil: 'அரிசி & தானியங்கள்',
        icon: 'Wheat',
        gradient: ['#fbbf24', '#f59e0b'],
    },
    spices: {
        id: 'spices',
        label: 'Spices & Masala',
        labelTamil: 'மசாலா பொருட்கள்',
        icon: 'Flame',
        gradient: ['#ef4444', '#dc2626'],
    },
    oil_ghee: {
        id: 'oil_ghee',
        label: 'Oil & Ghee',
        labelTamil: 'எண்ணெய் & நெய்',
        icon: 'Droplets',
        gradient: ['#fcd34d', '#f59e0b'],
    },
    snacks_bakery: {
        id: 'snacks_bakery',
        label: 'Snacks & Bakery',
        labelTamil: 'பேக்கரி & தின்பண்டங்கள்',
        icon: 'Cookie',
        gradient: ['#c084fc', '#a855f7'],
    },

    // Hardware & Construction
    hardware: {
        id: 'hardware',
        label: 'Hardware',
        labelTamil: 'ஹார்ட்வேர்',
        icon: 'Wrench',
        gradient: ['#64748b', '#475569'],
    },
    cement_sand: {
        id: 'cement_sand',
        label: 'Cement & Sand',
        labelTamil: 'சிமெண்ட் & மணல்',
        icon: 'Construction',
        gradient: ['#78716c', '#57534e'],
    },
    pipes_fittings: {
        id: 'pipes_fittings',
        label: 'Pipes & Fittings',
        labelTamil: 'பைப் & பிட்டிங்ஸ்',
        icon: 'PipetteIcon',
        gradient: ['#0ea5e9', '#0284c7'],
    },
    paint: {
        id: 'paint',
        label: 'Paints',
        labelTamil: 'பெயிண்ட்',
        icon: 'Paintbrush',
        gradient: ['#f472b6', '#ec4899'],
    },

    // Agriculture
    agriculture: {
        id: 'agriculture',
        label: 'Agriculture',
        labelTamil: 'விவசாய பொருட்கள்',
        icon: 'Tractor',
        gradient: ['#22c55e', '#15803d'],
    },
    seeds: {
        id: 'seeds',
        label: 'Seeds',
        labelTamil: 'விதைகள்',
        icon: 'Sprout',
        gradient: ['#4ade80', '#22c55e'],
    },
    fertilizers: {
        id: 'fertilizers',
        label: 'Fertilizers',
        labelTamil: 'உரங்கள்',
        icon: 'Leaf',
        gradient: ['#a3e635', '#84cc16'],
    },
    pesticides: {
        id: 'pesticides',
        label: 'Pesticides',
        labelTamil: 'பூச்சிக்கொல்லி',
        icon: 'Bug',
        gradient: ['#f87171', '#ef4444'],
    },
    farm_tools: {
        id: 'farm_tools',
        label: 'Farm Tools',
        labelTamil: 'விவசாய கருவிகள்',
        icon: 'Shovel',
        gradient: ['#a8a29e', '#78716c'],
    },

    // Textiles & Clothing
    textiles: {
        id: 'textiles',
        label: 'Textiles',
        labelTamil: 'துணி கடை',
        icon: 'Shirt',
        gradient: ['#c084fc', '#9333ea'],
    },
    sarees: {
        id: 'sarees',
        label: 'Sarees',
        labelTamil: 'புடவைகள்',
        icon: 'Sparkles',
        gradient: ['#fb7185', '#e11d48'],
    },
    readymade: {
        id: 'readymade',
        label: 'Readymade Clothes',
        labelTamil: 'ரெடிமேட்',
        icon: 'ShirtIcon',
        gradient: ['#818cf8', '#6366f1'],
    },

    // Electronics & Electrical
    electronics: {
        id: 'electronics',
        label: 'Electronics',
        labelTamil: 'எலக்ட்ரானிக்ஸ்',
        icon: 'Laptop',
        gradient: ['#38bdf8', '#0284c7'],
    },
    electrical: {
        id: 'electrical',
        label: 'Electrical Items',
        labelTamil: 'எலக்ட்ரிக்கல்',
        icon: 'Zap',
        gradient: ['#facc15', '#eab308'],
    },
    mobile: {
        id: 'mobile',
        label: 'Mobile & Accessories',
        labelTamil: 'மொபைல்',
        icon: 'Smartphone',
        gradient: ['#a78bfa', '#8b5cf6'],
    },
    fans_lights: {
        id: 'fans_lights',
        label: 'Fans & Lights',
        labelTamil: 'மின்விசிறி & லைட்',
        icon: 'Fan',
        gradient: ['#5eead4', '#14b8a6'],
    },

    // Home & Kitchen
    vessel_utensils: {
        id: 'vessel_utensils',
        label: 'Vessels & Utensils',
        labelTamil: 'பாத்திரங்கள்',
        icon: 'ChefHat',
        gradient: ['#94a3b8', '#64748b'],
    },
    plastic_items: {
        id: 'plastic_items',
        label: 'Plastic Items',
        labelTamil: 'பிளாஸ்டிக்',
        icon: 'Package',
        gradient: ['#2dd4bf', '#14b8a6'],
    },
    furniture: {
        id: 'furniture',
        label: 'Furniture',
        labelTamil: 'மரச்சாமான்கள்',
        icon: 'Armchair',
        gradient: ['#d97706', '#b45309'],
    },
    home_decor: {
        id: 'home_decor',
        label: 'Home Decor',
        labelTamil: 'வீட்டு அலங்காரம்',
        icon: 'Flower2',
        gradient: ['#f9a8d4', '#ec4899'],
    },

    // Health & Personal Care
    pharmacy: {
        id: 'pharmacy',
        label: 'Pharmacy',
        labelTamil: 'மருந்து கடை',
        icon: 'Pill',
        gradient: ['#4ade80', '#22c55e'],
    },
    beauty: {
        id: 'beauty',
        label: 'Beauty & Personal Care',
        labelTamil: 'அழகு சாதனங்கள்',
        icon: 'Sparkle',
        gradient: ['#fb7185', '#f43f5e'],
    },

    // Stationery & Books
    stationery: {
        id: 'stationery',
        label: 'Stationery',
        labelTamil: 'ஸ்டேஷனரி',
        icon: 'Pencil',
        gradient: ['#fbbf24', '#f59e0b'],
    },
    books: {
        id: 'books',
        label: 'Books',
        labelTamil: 'புத்தகங்கள்',
        icon: 'BookOpen',
        gradient: ['#60a5fa', '#3b82f6'],
    },

    // Others
    toys: {
        id: 'toys',
        label: 'Toys',
        labelTamil: 'பொம்மைகள்',
        icon: 'ToyBrick',
        gradient: ['#fb923c', '#f97316'],
    },
    puja_items: {
        id: 'puja_items',
        label: 'Puja Items',
        labelTamil: 'பூஜை சாமான்கள்',
        icon: 'Flame',
        gradient: ['#fcd34d', '#f59e0b'],
    },
    bicycle_parts: {
        id: 'bicycle_parts',
        label: 'Bicycle & Parts',
        labelTamil: 'சைக்கிள்',
        icon: 'Bike',
        gradient: ['#34d399', '#10b981'],
    },
    general: {
        id: 'general',
        label: 'General Store',
        labelTamil: 'ஜெனரல் ஸ்டோர்',
        icon: 'Store',
        gradient: ['#a78bfa', '#8b5cf6'],
    },
    other_product: {
        id: 'other_product',
        label: 'Other',
        labelTamil: 'இதர பொருட்கள்',
        icon: 'Package',
        gradient: ['#94a3b8', '#64748b'],
    },
};

// ============================================================================
// Service Category Icons - Rural Tamil Nadu Focus
// ============================================================================

export const serviceCategoryImages: Record<string, CategoryImage> = {
    // Construction & Repair
    plumbing: {
        id: 'plumbing',
        label: 'Plumbing',
        labelTamil: 'பிளம்பிங்',
        icon: 'Droplets',
        gradient: ['#0ea5e9', '#0284c7'],
    },
    electrical_work: {
        id: 'electrical_work',
        label: 'Electrical Work',
        labelTamil: 'எலக்ட்ரிக்கல் வேலை',
        icon: 'Zap',
        gradient: ['#facc15', '#eab308'],
    },
    carpentry: {
        id: 'carpentry',
        label: 'Carpentry',
        labelTamil: 'மர வேலை',
        icon: 'Hammer',
        gradient: ['#d97706', '#b45309'],
    },
    masonry: {
        id: 'masonry',
        label: 'Masonry',
        labelTamil: 'கொத்தனார்',
        icon: 'Brick',
        gradient: ['#f97316', '#ea580c'],
    },
    painting: {
        id: 'painting',
        label: 'Painting',
        labelTamil: 'பெயிண்டிங்',
        icon: 'Paintbrush',
        gradient: ['#c084fc', '#a855f7'],
    },
    welding: {
        id: 'welding',
        label: 'Welding',
        labelTamil: 'வெல்டிங்',
        icon: 'Flame',
        gradient: ['#f87171', '#ef4444'],
    },
    tiling: {
        id: 'tiling',
        label: 'Tiling & Flooring',
        labelTamil: 'டைல்ஸ் வேலை',
        icon: 'Grid3x3',
        gradient: ['#94a3b8', '#64748b'],
    },

    // Personal Care
    beauty_salon: {
        id: 'beauty_salon',
        label: 'Beauty Salon',
        labelTamil: 'பியூட்டி பார்லர்',
        icon: 'Sparkles',
        gradient: ['#fb7185', '#e11d48'],
    },
    barbershop: {
        id: 'barbershop',
        label: 'Barbershop',
        labelTamil: 'முடி வெட்டுதல்',
        icon: 'Scissors',
        gradient: ['#60a5fa', '#3b82f6'],
    },
    mehendi: {
        id: 'mehendi',
        label: 'Mehendi',
        labelTamil: 'மருதாணி',
        icon: 'Hand',
        gradient: ['#f97316', '#ea580c'],
    },

    // Tailoring & Clothing
    tailoring: {
        id: 'tailoring',
        label: 'Tailoring',
        labelTamil: 'தையல்',
        icon: 'Scissors',
        gradient: ['#a78bfa', '#8b5cf6'],
    },
    embroidery: {
        id: 'embroidery',
        label: 'Embroidery',
        labelTamil: 'எம்பிராய்டரி',
        icon: 'Sparkle',
        gradient: ['#f9a8d4', '#ec4899'],
    },

    // Vehicle Services
    motor_repair: {
        id: 'motor_repair',
        label: 'Two-Wheeler Repair',
        labelTamil: 'டூவீலர் ரிப்பேர்',
        icon: 'Bike',
        gradient: ['#64748b', '#475569'],
    },
    auto_repair: {
        id: 'auto_repair',
        label: 'Auto Repair',
        labelTamil: 'ஆட்டோ ரிப்பேர்',
        icon: 'Car',
        gradient: ['#facc15', '#eab308'],
    },
    car_service: {
        id: 'car_service',
        label: 'Car Service',
        labelTamil: 'கார் சர்வீஸ்',
        icon: 'Car',
        gradient: ['#38bdf8', '#0284c7'],
    },
    tyre_puncture: {
        id: 'tyre_puncture',
        label: 'Tyre & Puncture',
        labelTamil: 'டயர் & பஞ்சர்',
        icon: 'CircleDot',
        gradient: ['#78716c', '#57534e'],
    },

    // Electronics Repair
    mobile_repair: {
        id: 'mobile_repair',
        label: 'Mobile Repair',
        labelTamil: 'மொபைல் ரிப்பேர்',
        icon: 'Smartphone',
        gradient: ['#818cf8', '#6366f1'],
    },
    appliance_repair: {
        id: 'appliance_repair',
        label: 'Appliance Repair',
        labelTamil: 'அப்ளையன்ஸ் ரிப்பேர்',
        icon: 'Tv',
        gradient: ['#34d399', '#10b981'],
    },
    computer_repair: {
        id: 'computer_repair',
        label: 'Computer Repair',
        labelTamil: 'கம்ப்யூட்டர் ரிப்பேர்',
        icon: 'Monitor',
        gradient: ['#60a5fa', '#3b82f6'],
    },

    // Household Services
    cleaning: {
        id: 'cleaning',
        label: 'Cleaning',
        labelTamil: 'கிளீனிங்',
        icon: 'Sparkles',
        gradient: ['#2dd4bf', '#14b8a6'],
    },
    pest_control: {
        id: 'pest_control',
        label: 'Pest Control',
        labelTamil: 'பூச்சி கட்டுப்பாடு',
        icon: 'Bug',
        gradient: ['#84cc16', '#65a30d'],
    },
    laundry: {
        id: 'laundry',
        label: 'Laundry',
        labelTamil: 'லாண்ட்ரி',
        icon: 'ShirtIcon',
        gradient: ['#38bdf8', '#0284c7'],
    },
    water_tank_cleaning: {
        id: 'water_tank_cleaning',
        label: 'Water Tank Cleaning',
        labelTamil: 'தண்ணீர் தொட்டி சுத்தம்',
        icon: 'Droplet',
        gradient: ['#22d3ee', '#06b6d4'],
    },

    // Education & Professional
    tutoring: {
        id: 'tutoring',
        label: 'Tutoring',
        labelTamil: 'ட்யூஷன்',
        icon: 'GraduationCap',
        gradient: ['#818cf8', '#6366f1'],
    },
    driving_lessons: {
        id: 'driving_lessons',
        label: 'Driving Lessons',
        labelTamil: 'டிரைவிங் பயிற்சி',
        icon: 'Car',
        gradient: ['#f97316', '#ea580c'],
    },
    typing_center: {
        id: 'typing_center',
        label: 'Typing Center',
        labelTamil: 'டைப்பிங் செண்டர்',
        icon: 'Keyboard',
        gradient: ['#94a3b8', '#64748b'],
    },

    // Events & Occasions
    photography: {
        id: 'photography',
        label: 'Photography',
        labelTamil: 'போட்டோகிராபி',
        icon: 'Camera',
        gradient: ['#f472b6', '#ec4899'],
    },
    videography: {
        id: 'videography',
        label: 'Videography',
        labelTamil: 'வீடியோ படப்பிடிப்பு',
        icon: 'Video',
        gradient: ['#ef4444', '#dc2626'],
    },
    catering: {
        id: 'catering',
        label: 'Catering',
        labelTamil: 'கேட்டரிங்',
        icon: 'UtensilsCrossed',
        gradient: ['#fb923c', '#f97316'],
    },
    tent_pandal: {
        id: 'tent_pandal',
        label: 'Tent & Pandal',
        labelTamil: 'டென்ட் & பந்தல்',
        icon: 'Tent',
        gradient: ['#a3e635', '#84cc16'],
    },
    decoration: {
        id: 'decoration',
        label: 'Decoration',
        labelTamil: 'அலங்காரம்',
        icon: 'Flower2',
        gradient: ['#f9a8d4', '#ec4899'],
    },
    music_band: {
        id: 'music_band',
        label: 'Music & Band',
        labelTamil: 'இசை குழு',
        icon: 'Music',
        gradient: ['#a78bfa', '#8b5cf6'],
    },

    // Religious & Traditional
    priest_services: {
        id: 'priest_services',
        label: 'Priest Services',
        labelTamil: 'பூஜை',
        icon: 'Flame',
        gradient: ['#fcd34d', '#f59e0b'],
    },
    astrology: {
        id: 'astrology',
        label: 'Astrology',
        labelTamil: 'ஜோதிடம்',
        icon: 'Star',
        gradient: ['#fbbf24', '#f59e0b'],
    },

    // Health
    nursing: {
        id: 'nursing',
        label: 'Home Nursing',
        labelTamil: 'ஹோம் நர்ஸிங்',
        icon: 'Heart',
        gradient: ['#f87171', '#ef4444'],
    },
    physiotherapy: {
        id: 'physiotherapy',
        label: 'Physiotherapy',
        labelTamil: 'பிசியோதெரபி',
        icon: 'Activity',
        gradient: ['#4ade80', '#22c55e'],
    },

    // Other
    courier: {
        id: 'courier',
        label: 'Courier & Delivery',
        labelTamil: 'கூரியர்',
        icon: 'Truck',
        gradient: ['#60a5fa', '#3b82f6'],
    },
    driver: {
        id: 'driver',
        label: 'Driver',
        labelTamil: 'டிரைவர்',
        icon: 'User',
        gradient: ['#64748b', '#475569'],
    },
    other_service: {
        id: 'other_service',
        label: 'Other Services',
        labelTamil: 'இதர சேவைகள்',
        icon: 'Briefcase',
        gradient: ['#94a3b8', '#64748b'],
    },
};

// ============================================================================
// Shop Type Banners & Logos
// ============================================================================

export interface ShopBanner {
    id: string;
    type: string;
    label: string;
    labelTamil: string;
    /** Primary gradient for banner */
    bannerGradient: [string, string];
    /** Icon for logo */
    icon: string;
    /** Pattern overlay type */
    pattern: 'diagonal' | 'dots' | 'waves' | 'circles' | 'none';
}

export const shopBanners: Record<string, ShopBanner> = {
    grocery_store: {
        id: 'grocery_store',
        type: 'grocery',
        label: 'Grocery Store',
        labelTamil: 'மளிகை கடை',
        bannerGradient: ['#22c55e', '#15803d'],
        icon: 'ShoppingBasket',
        pattern: 'dots',
    },
    vegetable_shop: {
        id: 'vegetable_shop',
        type: 'vegetables',
        label: 'Vegetable Shop',
        labelTamil: 'காய்கறி கடை',
        bannerGradient: ['#84cc16', '#4d7c0f'],
        icon: 'Carrot',
        pattern: 'waves',
    },
    hardware_store: {
        id: 'hardware_store',
        type: 'hardware',
        label: 'Hardware Store',
        labelTamil: 'ஹார்ட்வேர் கடை',
        bannerGradient: ['#64748b', '#334155'],
        icon: 'Wrench',
        pattern: 'diagonal',
    },
    textile_shop: {
        id: 'textile_shop',
        type: 'textiles',
        label: 'Textile Shop',
        labelTamil: 'துணி கடை',
        bannerGradient: ['#a855f7', '#7e22ce'],
        icon: 'Shirt',
        pattern: 'waves',
    },
    electronics_shop: {
        id: 'electronics_shop',
        type: 'electronics',
        label: 'Electronics Shop',
        labelTamil: 'எலக்ட்ரானிக்ஸ் கடை',
        bannerGradient: ['#3b82f6', '#1d4ed8'],
        icon: 'Laptop',
        pattern: 'circles',
    },
    mobile_shop: {
        id: 'mobile_shop',
        type: 'mobile',
        label: 'Mobile Shop',
        labelTamil: 'மொபைல் கடை',
        bannerGradient: ['#8b5cf6', '#6d28d9'],
        icon: 'Smartphone',
        pattern: 'dots',
    },
    pharmacy: {
        id: 'pharmacy',
        type: 'pharmacy',
        label: 'Pharmacy',
        labelTamil: 'மருந்து கடை',
        bannerGradient: ['#10b981', '#047857'],
        icon: 'Pill',
        pattern: 'none',
    },
    stationery_shop: {
        id: 'stationery_shop',
        type: 'stationery',
        label: 'Stationery Shop',
        labelTamil: 'ஸ்டேஷனரி கடை',
        bannerGradient: ['#f59e0b', '#d97706'],
        icon: 'Pencil',
        pattern: 'diagonal',
    },
    agriculture_shop: {
        id: 'agriculture_shop',
        type: 'agriculture',
        label: 'Agriculture Shop',
        labelTamil: 'விவசாய கடை',
        bannerGradient: ['#22c55e', '#166534'],
        icon: 'Tractor',
        pattern: 'waves',
    },
    bakery: {
        id: 'bakery',
        type: 'bakery',
        label: 'Bakery',
        labelTamil: 'பேக்கரி',
        bannerGradient: ['#f97316', '#c2410c'],
        icon: 'Cookie',
        pattern: 'dots',
    },
    restaurant: {
        id: 'restaurant',
        type: 'restaurant',
        label: 'Restaurant',
        labelTamil: 'உணவகம்',
        bannerGradient: ['#ef4444', '#b91c1c'],
        icon: 'UtensilsCrossed',
        pattern: 'none',
    },
    general_store: {
        id: 'general_store',
        type: 'general',
        label: 'General Store',
        labelTamil: 'ஜெனரல் ஸ்டோர்',
        bannerGradient: ['#6366f1', '#4338ca'],
        icon: 'Store',
        pattern: 'diagonal',
    },
    service_provider: {
        id: 'service_provider',
        type: 'service',
        label: 'Service Provider',
        labelTamil: 'சேவை வழங்குநர்',
        bannerGradient: ['#0ea5e9', '#0369a1'],
        icon: 'Briefcase',
        pattern: 'circles',
    },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get product category image by ID, with fallback
 */
export function getProductImage(categoryId: string): CategoryImage {
    return productCategoryImages[categoryId] || productCategoryImages.other_product;
}

/**
 * Get service category image by ID, with fallback
 */
export function getServiceImage(categoryId: string): CategoryImage {
    return serviceCategoryImages[categoryId] || serviceCategoryImages.other_service;
}

/**
 * Get shop banner by type, with fallback
 */
export function getShopBanner(shopType: string): ShopBanner {
    return shopBanners[shopType] || shopBanners.general_store;
}

/**
 * Get all product categories as array for dropdowns
 */
export function getProductCategoriesArray(): CategoryImage[] {
    return Object.values(productCategoryImages);
}

/**
 * Get all service categories as array for dropdowns
 */
export function getServiceCategoriesArray(): CategoryImage[] {
    return Object.values(serviceCategoryImages);
}

/**
 * Get all shop banners as array for selection
 */
export function getShopBannersArray(): ShopBanner[] {
    return Object.values(shopBanners);
}

/**
 * Generate CSS gradient string
 */
export function getGradientCSS(gradient: [string, string], direction = '135deg'): string {
    return `linear-gradient(${direction}, ${gradient[0]}, ${gradient[1]})`;
}
