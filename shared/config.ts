export type FilterOption = {
  value: string;
  label: string;
  translationKey?: string;
};

export type AttributeFilterConfig = {
  key: string;
  label: string;
  type: "text" | "select";
  options?: FilterOption[];
  placeholder?: string;
};

export const platformFees = {
  /** Default fee applied to product orders and cart calculations */
  productOrder: 1,
  /** Fee applied when customers book services */
  serviceBooking: 1,
} as const;

export const featureFlags = {
  /** Disable platform fees until pricing is finalized. */
  platformFeesEnabled: false,
  /** Show a line-item breakdown when legally required. */
  platformFeeBreakdownEnabled: false,
} as const;

export const productFilterConfig: {
  categories: FilterOption[];
  attributeFilters: AttributeFilterConfig[];
} = {
  categories: [
    // Groceries & Food - Most common in rural TN
    { value: "groceries", label: "Groceries", translationKey: "groceries" },
    { value: "vegetables", label: "Vegetables", translationKey: "vegetables" },
    { value: "fruits", label: "Fruits", translationKey: "fruits" },
    { value: "dairy", label: "Dairy Products", translationKey: "dairy" },
    { value: "rice_grains", label: "Rice & Grains", translationKey: "rice_grains" },
    { value: "spices", label: "Spices & Masala", translationKey: "spices" },
    { value: "oil_ghee", label: "Oil & Ghee", translationKey: "oil_ghee" },
    { value: "snacks_bakery", label: "Snacks & Bakery", translationKey: "snacks_bakery" },
    // Hardware & Construction
    { value: "hardware", label: "Hardware", translationKey: "hardware" },
    { value: "cement_sand", label: "Cement & Sand", translationKey: "cement_sand" },
    { value: "pipes_fittings", label: "Pipes & Fittings", translationKey: "pipes_fittings" },
    { value: "paint", label: "Paints", translationKey: "paint" },
    // Agriculture
    { value: "agriculture", label: "Agriculture", translationKey: "agriculture" },
    { value: "seeds", label: "Seeds", translationKey: "seeds" },
    { value: "fertilizers", label: "Fertilizers", translationKey: "fertilizers" },
    { value: "pesticides", label: "Pesticides", translationKey: "pesticides" },
    { value: "farm_tools", label: "Farm Tools", translationKey: "farm_tools" },
    // Textiles
    { value: "textiles", label: "Textiles", translationKey: "textiles" },
    { value: "sarees", label: "Sarees", translationKey: "sarees" },
    { value: "readymade", label: "Readymade Clothes", translationKey: "readymade" },
    // Electronics & Electrical
    { value: "electronics", label: "Electronics", translationKey: "electronics" },
    { value: "electrical", label: "Electrical Items", translationKey: "electrical" },
    { value: "mobile", label: "Mobile & Accessories", translationKey: "mobile" },
    { value: "fans_lights", label: "Fans & Lights", translationKey: "fans_lights" },
    // Home & Kitchen
    { value: "vessel_utensils", label: "Vessels & Utensils", translationKey: "vessel_utensils" },
    { value: "plastic_items", label: "Plastic Items", translationKey: "plastic_items" },
    { value: "furniture", label: "Furniture", translationKey: "furniture" },
    { value: "home_decor", label: "Home Decor", translationKey: "home_decor" },
    // Health & Personal Care
    { value: "pharmacy", label: "Pharmacy", translationKey: "pharmacy" },
    { value: "beauty", label: "Beauty & Personal Care", translationKey: "beauty" },
    // Stationery & Books
    { value: "stationery", label: "Stationery", translationKey: "stationery" },
    { value: "books", label: "Books", translationKey: "books" },
    // Others
    { value: "toys", label: "Toys", translationKey: "toys" },
    { value: "puja_items", label: "Puja Items", translationKey: "puja_items" },
    { value: "bicycle_parts", label: "Bicycle & Parts", translationKey: "bicycle_parts" },
    { value: "general", label: "General Store", translationKey: "general" },
    { value: "other_product", label: "Other", translationKey: "other_product" },
  ],
  attributeFilters: [
    {
      key: "color",
      label: "Color",
      type: "text",
      placeholder: "e.g., Red",
    },
    {
      key: "size",
      label: "Size",
      type: "text",
      placeholder: "e.g., M",
    },
  ],
};

export const serviceFilterConfig: {
  categories: FilterOption[];
} = {
  categories: [
    { value: "all", label: "All", translationKey: "all" },
    // Construction & Repair - Very common in rural TN
    { value: "plumbing", label: "Plumbing", translationKey: "plumbing" },
    { value: "electrical_work", label: "Electrical Work", translationKey: "electrical_work" },
    { value: "carpentry", label: "Carpentry", translationKey: "carpentry" },
    { value: "masonry", label: "Masonry", translationKey: "masonry" },
    { value: "painting", label: "Painting", translationKey: "painting" },
    { value: "welding", label: "Welding", translationKey: "welding" },
    { value: "tiling", label: "Tiling & Flooring", translationKey: "tiling" },
    // Personal Care
    { value: "beauty_salon", label: "Beauty Salon", translationKey: "beauty_salon" },
    { value: "barbershop", label: "Barbershop", translationKey: "barbershop" },
    { value: "mehendi", label: "Mehendi", translationKey: "mehendi" },
    // Tailoring
    { value: "tailoring", label: "Tailoring", translationKey: "tailoring" },
    { value: "embroidery", label: "Embroidery", translationKey: "embroidery" },
    // Vehicle Services
    { value: "motor_repair", label: "Two-Wheeler Repair", translationKey: "motor_repair" },
    { value: "auto_repair", label: "Auto Repair", translationKey: "auto_repair" },
    { value: "car_service", label: "Car Service", translationKey: "car_service" },
    { value: "tyre_puncture", label: "Tyre & Puncture", translationKey: "tyre_puncture" },
    // Electronics Repair
    { value: "mobile_repair", label: "Mobile Repair", translationKey: "mobile_repair" },
    { value: "appliance_repair", label: "Appliance Repair", translationKey: "appliance_repair" },
    { value: "computer_repair", label: "Computer Repair", translationKey: "computer_repair" },
    // Household Services
    { value: "cleaning", label: "Cleaning", translationKey: "cleaning" },
    { value: "pest_control", label: "Pest Control", translationKey: "pest_control" },
    { value: "laundry", label: "Laundry", translationKey: "laundry" },
    { value: "water_tank_cleaning", label: "Water Tank Cleaning", translationKey: "water_tank_cleaning" },
    // Education & Professional
    { value: "tutoring", label: "Tutoring", translationKey: "tutoring" },
    { value: "driving_lessons", label: "Driving Lessons", translationKey: "driving_lessons" },
    { value: "typing_center", label: "Typing Center", translationKey: "typing_center" },
    // Events & Occasions
    { value: "photography", label: "Photography", translationKey: "photography" },
    { value: "videography", label: "Videography", translationKey: "videography" },
    { value: "catering", label: "Catering", translationKey: "catering" },
    { value: "tent_pandal", label: "Tent & Pandal", translationKey: "tent_pandal" },
    { value: "decoration", label: "Decoration", translationKey: "decoration" },
    { value: "music_band", label: "Music & Band", translationKey: "music_band" },
    // Religious & Traditional
    { value: "priest_services", label: "Priest Services", translationKey: "priest_services" },
    { value: "astrology", label: "Astrology", translationKey: "astrology" },
    // Health
    { value: "nursing", label: "Home Nursing", translationKey: "nursing" },
    { value: "physiotherapy", label: "Physiotherapy", translationKey: "physiotherapy" },
    // Other
    { value: "courier", label: "Courier & Delivery", translationKey: "courier" },
    { value: "driver", label: "Driver", translationKey: "driver" },
    { value: "other_service", label: "Other Services", translationKey: "other_service" },
  ],
};
