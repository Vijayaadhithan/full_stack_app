import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAppMode, useUserContext } from "@/contexts/UserContext";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Store, Wrench, User, Check, Plus, ChevronDown, Loader2, MapPin } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AppMode } from "@shared/schema";

const MODE_CONFIG: Record<AppMode, { icon: React.ReactNode; label: string; description: string; color: string }> = {
    CUSTOMER: {
        icon: <User className="w-5 h-5" />,
        label: "Customer",
        description: "Browse & book services",
        color: "bg-orange-500",
    },
    SHOP: {
        icon: <Store className="w-5 h-5" />,
        label: "Shop Owner",
        description: "Manage your shop",
        color: "bg-green-500",
    },
    PROVIDER: {
        icon: <Wrench className="w-5 h-5" />,
        label: "Service Provider",
        description: "Offer your services",
        color: "bg-blue-500",
    },
};

interface ProfileSwitcherProps {
    onCreateShop?: () => void;
    onCreateProvider?: () => void;
}

export function ProfileSwitcher({ onCreateShop: _onCreateShop, onCreateProvider: _onCreateProvider }: ProfileSwitcherProps) {
    const [, setLocation] = useLocation();
    const { appMode, setAppMode, refetchProfiles } = useAppMode();
    const { profiles } = useUserContext();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [showShopForm, setShowShopForm] = useState(false);
    const [showProviderForm, setShowProviderForm] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Shop form state
    const [shopName, setShopName] = useState("");
    const [shopDescription, setShopDescription] = useState("");
    const [useCustomerAddress, setUseCustomerAddress] = useState(true);

    // Provider form state
    const [providerBio, setProviderBio] = useState("");
    const [useCustomerAddressProvider, setUseCustomerAddressProvider] = useState(true);

    // Temp address state for when useCustomerAddress is false
    const [tempAddress, setTempAddress] = useState({
        street: "",
        city: "",
        state: "",
        pincode: ""
    });

    const currentMode = MODE_CONFIG[appMode];

    const handleModeSwitch = (mode: AppMode) => {
        setAppMode(mode);
        setIsOpen(false);
        // Navigate to the appropriate dashboard
        if (mode === "CUSTOMER") {
            setLocation("/customer");
        } else if (mode === "SHOP") {
            setLocation("/shop");
        } else if (mode === "PROVIDER") {
            setLocation("/provider");
        }
    };

    const handleCreateShop = async () => {
        if (!shopName.trim()) {
            toast({ title: "Error", description: "Shop name is required", variant: "destructive" });
            return;
        }

        setIsCreating(true);
        try {
            await apiRequest("POST", "/api/auth/create-shop", {
                shopName: shopName.trim(),
                description: shopDescription.trim(),
                useCustomerAddress,
            });

            toast({ title: "Success!", description: "Your shop has been created" });

            // Refresh profiles and switch to shop mode
            await queryClient.invalidateQueries({ queryKey: ["/api/auth/profiles"] });
            refetchProfiles();

            // Reset form
            setShopName("");
            setShopDescription("");
            setShowShopForm(false);
            setIsOpen(false);

            // Navigate to shop dashboard
            setLocation("/shop");
        } catch (error: any) {
            toast({
                title: "Error",
                description: error?.message || "Failed to create shop",
                variant: "destructive"
            });
        } finally {
            setIsCreating(false);
        }
    };

    const handleCreateProvider = async () => {
        setIsCreating(true);
        try {
            await apiRequest("POST", "/api/auth/create-provider", {
                bio: providerBio.trim(),
                useCustomerAddress: useCustomerAddressProvider,
            });

            toast({ title: "Success!", description: "Your provider profile has been created" });

            // Refresh profiles
            await queryClient.invalidateQueries({ queryKey: ["/api/auth/profiles"] });
            refetchProfiles();

            // Reset form
            setProviderBio("");
            setShowProviderForm(false);
            setIsOpen(false);

            // Navigate to provider dashboard
            setLocation("/provider");
        } catch (error: any) {
            toast({
                title: "Error",
                description: error?.message || "Failed to create provider profile",
                variant: "destructive"
            });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
            <DrawerTrigger asChild>
                <Button variant="outline" className="w-[180px] justify-between">
                    <div className="flex items-center gap-2">
                        {currentMode.icon}
                        <span>{currentMode.label}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
            </DrawerTrigger>
            <DrawerContent>
                <DrawerHeader>
                    <DrawerTitle className="text-center text-lg">
                        {showShopForm ? "Create Your Shop" : showProviderForm ? "Become a Provider" : "Switch Mode"}
                    </DrawerTitle>
                </DrawerHeader>
                <div className="p-4 space-y-3 pb-8 max-h-[70vh] overflow-y-auto">
                    {/* Shop Creation Form */}
                    {showShopForm && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Shop Name *</Label>
                                <Input
                                    value={shopName}
                                    onChange={(e) => setShopName(e.target.value)}
                                    placeholder="Enter your shop name"
                                    className="h-12"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Description (Optional)</Label>
                                <Input
                                    value={shopDescription}
                                    onChange={(e) => setShopDescription(e.target.value)}
                                    placeholder="What do you sell?"
                                    className="h-12"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="use-address"
                                        checked={useCustomerAddress}
                                        onCheckedChange={(c) => setUseCustomerAddress(!!c)}
                                    />
                                    <Label htmlFor="use-address">Use my current address</Label>
                                </div>

                                {!useCustomerAddress && (
                                    <div className="space-y-4 border-l-2 pl-4 border-muted">
                                        <p className="text-sm text-muted-foreground">New Shop Address</p>
                                        <Input placeholder="Street Address" value={tempAddress.street} onChange={(e) => setTempAddress({ ...tempAddress, street: e.target.value })} />
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input placeholder="City" value={tempAddress.city} onChange={(e) => setTempAddress({ ...tempAddress, city: e.target.value })} />
                                            <Input placeholder="Pincode" value={tempAddress.pincode} onChange={(e) => setTempAddress({ ...tempAddress, pincode: e.target.value })} />
                                        </div>
                                        <Input placeholder="State (Optional)" value={tempAddress.state} onChange={(e) => setTempAddress({ ...tempAddress, state: e.target.value })} />
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" onClick={() => setShowShopForm(false)} className="flex-1">
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleCreateShop}
                                    disabled={isCreating || !shopName.trim() || (!useCustomerAddress && (!tempAddress.street.trim() || !tempAddress.city.trim() || !tempAddress.pincode.trim()))}
                                    className="flex-1 bg-green-500 hover:bg-green-600"
                                >
                                    {isCreating ? <Loader2 className="animate-spin" /> : "Create Shop"}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Provider Creation Form */}
                    {showProviderForm && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>About You (Optional)</Label>
                                <Input
                                    value={providerBio}
                                    onChange={(e) => setProviderBio(e.target.value)}
                                    placeholder="Tell customers about your services"
                                    className="h-12"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />
                                    Service Location
                                </Label>
                                <div className="flex gap-2">
                                    <Button
                                        variant={useCustomerAddressProvider ? "default" : "outline"}
                                        onClick={() => setUseCustomerAddressProvider(true)}
                                        className="flex-1"
                                        size="sm"
                                    >
                                        Same as my address
                                    </Button>
                                    <Button
                                        variant={!useCustomerAddressProvider ? "default" : "outline"}
                                        onClick={() => setUseCustomerAddressProvider(false)}
                                        className="flex-1"
                                        size="sm"
                                    >
                                        Different location
                                    </Button>
                                </div>
                                {!useCustomerAddressProvider && (
                                    <p className="text-sm text-gray-500">You can set a different location in Provider Settings later.</p>
                                )}
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" onClick={() => setShowProviderForm(false)} className="flex-1">
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleCreateProvider}
                                    disabled={isCreating}
                                    className="flex-1 bg-blue-500 hover:bg-blue-600"
                                >
                                    {isCreating ? <Loader2 className="animate-spin" /> : "Start Providing"}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Mode Selection (default view) */}
                    {!showShopForm && !showProviderForm && (
                        <>
                            {/* Customer Mode - Always available */}
                            <button
                                onClick={() => handleModeSwitch("CUSTOMER")}
                                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${appMode === "CUSTOMER"
                                    ? "border-orange-500 bg-orange-50"
                                    : "border-gray-200 hover:border-orange-300"
                                    }`}
                            >
                                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                    {MODE_CONFIG.CUSTOMER.icon}
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-semibold text-lg">{MODE_CONFIG.CUSTOMER.label}</div>
                                    <div className="text-sm text-gray-500">{MODE_CONFIG.CUSTOMER.description}</div>
                                </div>
                                {appMode === "CUSTOMER" && <Check className="w-6 h-6 text-orange-500" />}
                            </button>

                            {/* Shop Mode */}
                            {profiles.hasShop ? (
                                <button
                                    onClick={() => handleModeSwitch("SHOP")}
                                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${appMode === "SHOP"
                                        ? "border-green-500 bg-green-50"
                                        : "border-gray-200 hover:border-green-300"
                                        }`}
                                >
                                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                        {MODE_CONFIG.SHOP.icon}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="font-semibold text-lg">{profiles.shop?.shopName || MODE_CONFIG.SHOP.label}</div>
                                        <div className="text-sm text-gray-500">{MODE_CONFIG.SHOP.description}</div>
                                    </div>
                                    {appMode === "SHOP" && <Check className="w-6 h-6 text-green-500" />}
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowShopForm(true)}
                                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-green-400 hover:bg-green-50 transition-all"
                                >
                                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                        <Plus className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="font-semibold text-lg text-gray-600">Become a Seller</div>
                                        <div className="text-sm text-gray-400">Start selling products</div>
                                    </div>
                                </button>
                            )}

                            {/* Provider Mode */}
                            {profiles.hasProvider ? (
                                <button
                                    onClick={() => handleModeSwitch("PROVIDER")}
                                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${appMode === "PROVIDER"
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-gray-200 hover:border-blue-300"
                                        }`}
                                >
                                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                        {MODE_CONFIG.PROVIDER.icon}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="font-semibold text-lg">{MODE_CONFIG.PROVIDER.label}</div>
                                        <div className="text-sm text-gray-500">{MODE_CONFIG.PROVIDER.description}</div>
                                    </div>
                                    {appMode === "PROVIDER" && <Check className="w-6 h-6 text-blue-500" />}
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowProviderForm(true)}
                                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all"
                                >
                                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                        <Plus className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="font-semibold text-lg text-gray-600">Become a Provider</div>
                                        <div className="text-sm text-gray-400">Offer your services</div>
                                    </div>
                                </button>
                            )}
                        </>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    );
}

// Compact version for header/navbar
export function ModeIndicator() {
    const { appMode } = useAppMode();
    const mode = MODE_CONFIG[appMode];

    return (
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${mode.color} text-white`}>
            {mode.icon}
            <span className="text-sm font-medium">{mode.label}</span>
        </div>
    );
}
