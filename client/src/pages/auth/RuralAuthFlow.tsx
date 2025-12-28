import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Loader2, Phone, Lock, User, ArrowLeft, Store, Wrench, UserCircle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LogoMark from "@/components/branding/logo-mark";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthStep = "phone" | "otp" | "pin-entry" | "pin-setup" | "profile-setup";
type Language = "en" | "ta";

interface RuralAuthFlowProps {
    onSuccess?: () => void;
}

// Bilingual translations
const translations = {
    en: {
        enterPhone: "Enter your mobile number",
        phonePlaceholder: "9876543210",
        getOtp: "Get OTP",
        enterOtp: "Enter OTP",
        verify: "Verify",
        enterPin: "Enter your PIN",
        createPin: "Create a 4-digit PIN",
        confirmPin: "Confirm PIN",
        forgotPin: "Forgot PIN?",
        login: "Login",
        next: "Next",
        back: "Back",
        yourName: "Your Name",
        chooseRole: "How will you use the app?",
        customer: "Customer",
        customerDesc: "Book services & shop products",
        shop: "Shop Owner",
        shopDesc: "Sell your products",
        provider: "Service Provider",
        providerDesc: "Offer your services",
        welcome: "Welcome!",
        complete: "Save & Login",
        switchLang: "தமிழ்",
    },
    ta: {
        enterPhone: "உங்கள் மொபைல் எண்",
        phonePlaceholder: "9876543210",
        getOtp: "OTP பெறுக",
        enterOtp: "OTP உள்ளிடுக",
        verify: "சரிபார்க்கவும்",
        enterPin: "உங்கள் PIN",
        createPin: "4 இலக்க PIN உருவாக்கவும்",
        confirmPin: "PIN உறுதிப்படுத்தவும்",
        forgotPin: "PIN மறந்துவிட்டதா?",
        login: "உள்நுழை",
        next: "அடுத்து",
        back: "பின்",
        yourName: "உங்கள் பெயர்",
        chooseRole: "நீங்கள் யார்?",
        customer: "வாடிக்கையாளர்",
        customerDesc: "சேவைகளை முன்பதிவு செய்க",
        shop: "கடை உரிமையாளர்",
        shopDesc: "பொருட்களை விற்கவும்",
        provider: "சேவை வழங்குநர்",
        providerDesc: "சேவைகளை வழங்கவும்",
        welcome: "வரவேற்பு!",
        complete: "சேமி & உள்நுழை",
        switchLang: "English",
    },
};

export default function RuralAuthFlow({ onSuccess }: RuralAuthFlowProps) {
    const [, setLocation] = useLocation();
    const { toast } = useToast();

    // Language state - default to English
    const [language, setLanguage] = useState<Language>("en");
    const t = translations[language];

    // Auth state
    const [step, setStep] = useState<AuthStep>("phone");
    const [isLoading, setIsLoading] = useState(false);
    const [isExistingUser, setIsExistingUser] = useState(false);
    const [userName, setUserName] = useState("");

    // Form data
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [pin, setPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");
    const [name, setName] = useState("");
    const [selectedRole, setSelectedRole] = useState<"customer" | "shop" | "provider">("customer");

    // Refs for large inputs
    const phoneInputRef = useRef<HTMLInputElement>(null);
    const pinInputRef = useRef<HTMLInputElement>(null);
    const otpInputRef = useRef<HTMLInputElement>(null);

    // Load remembered phone from localStorage
    useEffect(() => {
        const savedPhone = localStorage.getItem("lastPhone");
        if (savedPhone) {
            setPhone(savedPhone);
        }
    }, []);

    // Focus inputs on step change
    useEffect(() => {
        if (step === "phone" && phoneInputRef.current) {
            phoneInputRef.current.focus();
        } else if (step === "pin-entry" && pinInputRef.current) {
            pinInputRef.current.focus();
        } else if (step === "otp" && otpInputRef.current) {
            otpInputRef.current.focus();
        }
    }, [step]);

    // Handle phone submission
    async function handlePhoneSubmit() {
        if (phone.length !== 10 || !/^\d{10}$/.test(phone)) {
            toast({ title: "Invalid phone", description: "Please enter 10 digits", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            const res = await apiRequest("POST", "/api/auth/check-user", { phone });
            const data = await res.json();

            // Save phone for "Remember Me"
            localStorage.setItem("lastPhone", phone);

            if (data.exists) {
                setIsExistingUser(true);
                setUserName(data.name || "");
                setStep("pin-entry");
            } else {
                setIsExistingUser(false);
                // New user - trigger OTP flow
                // For now, we'll skip Firebase OTP and go straight to setup
                // In production, integrate Firebase signInWithPhoneNumber here
                setStep("otp");
            }
        } catch (error) {
            toast({ title: "Error", description: "Could not check phone number", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }

    // Handle OTP verification (placeholder - integrate Firebase here)
    async function handleOtpVerify() {
        if (otp.length !== 6) {
            toast({ title: "Invalid OTP", description: "Please enter 6 digits", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        // TODO: Verify OTP with Firebase
        // For demo, simulate verification
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsLoading(false);
        setStep("profile-setup");
    }

    // Handle PIN login
    async function handlePinLogin() {
        if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
            toast({ title: "Invalid PIN", description: "Please enter 4 digits", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            const res = await apiRequest("POST", "/api/auth/login-pin", { phone, pin });
            if (!res.ok) {
                const data = await res.json();
                toast({ title: "Login failed", description: data.message, variant: "destructive" });
                return;
            }

            const user = await res.json();
            queryClient.setQueryData(["/api/user"], user);

            toast({ title: t.welcome, description: `${userName || user.name}!` });

            const targetPath = user.role === "worker" ? "/shop" : `/${user.role || "customer"}`;
            setLocation(targetPath);
            onSuccess?.();
        } catch (error) {
            toast({ title: "Error", description: "Login failed", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }

    // Handle forgot PIN
    async function handleForgotPin() {
        setIsLoading(true);
        // Trigger OTP flow for PIN reset
        // TODO: Integrate Firebase OTP
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsLoading(false);
        setStep("otp");
    }

    // Handle profile setup submission
    async function handleProfileSetup() {
        if (!name.trim()) {
            toast({ title: "Name required", description: "Please enter your name", variant: "destructive" });
            return;
        }
        setStep("pin-setup");
    }

    // Handle PIN setup and registration
    async function handlePinSetup() {
        if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
            toast({ title: "Invalid PIN", description: "PIN must be 4 digits", variant: "destructive" });
            return;
        }
        if (pin !== confirmPin) {
            toast({ title: "PIN mismatch", description: "PINs do not match", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            const res = await apiRequest("POST", "/api/auth/rural-register", {
                phone,
                name: name.trim(),
                pin,
                initialRole: selectedRole,
                language: "ta",
            });

            if (!res.ok) {
                const data = await res.json();
                toast({ title: "Registration failed", description: data.message, variant: "destructive" });
                return;
            }

            const user = await res.json();
            queryClient.setQueryData(["/api/user"], user);

            toast({ title: t.welcome, description: `${name}!` });

            const targetPath = `/${selectedRole}`;
            setLocation(targetPath);
            onSuccess?.();
        } catch (error) {
            toast({ title: "Error", description: "Registration failed", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }

    // Render based on step
    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 flex items-center justify-center p-4">
            {/* Decorative background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-24 -left-24 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-yellow-400/20 rounded-full blur-3xl" />
                <div className="absolute top-1/4 right-1/4 w-48 h-48 bg-orange-300/20 rounded-full blur-2xl" />
            </div>

            <Card className="w-full max-w-md shadow-2xl backdrop-blur-sm bg-white/95 border-0 relative z-10">
                <CardHeader className="text-center pb-4">
                    {/* Language Dropdown */}
                    <div className="flex justify-end mb-2">
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value as Language)}
                            className="px-3 py-1.5 rounded-full text-sm font-medium bg-orange-100 text-orange-700 border-0 focus:ring-2 focus:ring-orange-300 cursor-pointer"
                        >
                            <option value="en">🇬🇧 English</option>
                            <option value="ta">🇮🇳 தமிழ்</option>
                        </select>
                    </div>

                    {/* Logo and Title */}
                    <div className="flex justify-center mb-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <LogoMark size={48} />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-800">
                        {step === "pin-entry" && userName
                            ? (language === "en" ? `Hello, ${userName}!` : `வணக்கம், ${userName}!`)
                            : (language === "en" ? "Welcome to DoorStepTN" : "DoorStepTN க்கு வரவேற்கிறோம்!")}
                    </CardTitle>
                    <p className="text-gray-500 text-sm mt-1">
                        {language === "en" ? "Your local services, delivered" : "உங்கள் உள்ளூர் சேவைகள்"}
                    </p>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Step: Phone Entry */}
                    {step === "phone" && (
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label className="text-base font-medium text-gray-700">{t.enterPhone}</Label>
                                <div className="relative">
                                    <div className="absolute left-0 top-0 h-full flex items-center pl-4 pointer-events-none">
                                        <span className="text-lg font-semibold text-gray-400">+91</span>
                                    </div>
                                    <Input
                                        ref={phoneInputRef}
                                        type="tel"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={10}
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                        placeholder={t.phonePlaceholder}
                                        className="pl-16 h-14 text-xl font-mono tracking-widest text-center border-2 border-gray-200 focus:border-orange-400 rounded-xl transition-colors"
                                        autoComplete="tel"
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={handlePhoneSubmit}
                                disabled={isLoading || phone.length !== 10}
                                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 rounded-xl shadow-lg shadow-orange-200 transition-all"
                            >
                                {isLoading ? <Loader2 className="animate-spin" /> : t.getOtp}
                            </Button>
                        </div>
                    )}

                    {/* Step: OTP Verification */}
                    {step === "otp" && (
                        <div className="space-y-5">
                            <Button
                                variant="ghost"
                                onClick={() => setStep("phone")}
                                className="mb-2 text-gray-600 hover:text-gray-800"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" /> {t.back}
                            </Button>
                            <div className="space-y-2">
                                <Label className="text-base font-medium text-gray-700">{t.enterOtp}</Label>
                                <p className="text-sm text-gray-500">
                                    {language === "en" ? `OTP sent to +91 ${phone}` : `+91 ${phone} க்கு OTP அனுப்பப்பட்டது`}
                                </p>
                            </div>
                            <Input
                                ref={otpInputRef}
                                type="tel"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                placeholder="• • • • • •"
                                className="h-14 text-2xl font-mono tracking-[0.5em] text-center border-2 border-gray-200 focus:border-orange-400 rounded-xl"
                            />
                            <Button
                                onClick={handleOtpVerify}
                                disabled={isLoading || otp.length !== 6}
                                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 rounded-xl shadow-lg shadow-orange-200"
                            >
                                {isLoading ? <Loader2 className="animate-spin" /> : t.verify}
                            </Button>
                        </div>
                    )}

                    {/* Step: PIN Entry (Existing User) */}
                    {step === "pin-entry" && (
                        <div className="space-y-5">
                            <Button
                                variant="ghost"
                                onClick={() => setStep("phone")}
                                className="mb-2 text-gray-600 hover:text-gray-800"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" /> {t.back}
                            </Button>
                            <div className="space-y-2">
                                <Label className="text-base font-medium text-gray-700">{t.enterPin}</Label>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <Input
                                    ref={pinInputRef}
                                    type="password"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={4}
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                    placeholder="• • • •"
                                    className="pl-12 h-14 text-2xl tracking-[0.5em] text-center border-2 border-gray-200 focus:border-orange-400 rounded-xl"
                                />
                            </div>
                            <Button
                                onClick={handlePinLogin}
                                disabled={isLoading || pin.length !== 4}
                                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 rounded-xl shadow-lg shadow-orange-200"
                            >
                                {isLoading ? <Loader2 className="animate-spin" /> : t.login}
                            </Button>
                            <Button
                                variant="link"
                                onClick={handleForgotPin}
                                disabled={isLoading}
                                className="w-full text-gray-500"
                            >
                                {t.forgotPin}
                            </Button>
                        </div>
                    )}

                    {/* Step: Profile Setup (New User) */}
                    {step === "profile-setup" && (
                        <div className="space-y-4">
                            <Button
                                variant="ghost"
                                onClick={() => setStep("otp")}
                                className="mb-2"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" /> {t.back}
                            </Button>

                            <div className="space-y-2">
                                <Label className="text-lg font-medium">{t.yourName}</Label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
                                    <Input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="பெயர்"
                                        className="pl-14 h-14 text-xl"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-lg font-medium">{t.chooseRole}</Label>
                                <div className="grid gap-3">
                                    <RoleButton
                                        icon={<UserCircle className="w-8 h-8" />}
                                        title={t.customer}
                                        description={t.customerDesc}
                                        selected={selectedRole === "customer"}
                                        onClick={() => setSelectedRole("customer")}
                                        color="orange"
                                    />
                                    <RoleButton
                                        icon={<Store className="w-8 h-8" />}
                                        title={t.shop}
                                        description={t.shopDesc}
                                        selected={selectedRole === "shop"}
                                        onClick={() => setSelectedRole("shop")}
                                        color="green"
                                    />
                                    <RoleButton
                                        icon={<Wrench className="w-8 h-8" />}
                                        title={t.provider}
                                        description={t.providerDesc}
                                        selected={selectedRole === "provider"}
                                        onClick={() => setSelectedRole("provider")}
                                        color="blue"
                                    />
                                </div>
                            </div>

                            <Button
                                onClick={handleProfileSetup}
                                disabled={!name.trim()}
                                className="w-full h-14 text-lg font-semibold"
                            >
                                {t.next}
                            </Button>
                        </div>
                    )}

                    {/* Step: PIN Setup (New User) */}
                    {step === "pin-setup" && (
                        <div className="space-y-4">
                            <Button
                                variant="ghost"
                                onClick={() => setStep("profile-setup")}
                                className="mb-2"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" /> {t.back}
                            </Button>

                            <div className="space-y-2">
                                <Label className="text-lg font-medium">{t.createPin}</Label>
                                <Input
                                    type="password"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={4}
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                    placeholder="• • • •"
                                    className="h-16 text-3xl tracking-[0.5em] text-center"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-lg font-medium">{t.confirmPin}</Label>
                                <Input
                                    type="password"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={4}
                                    value={confirmPin}
                                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                    placeholder="• • • •"
                                    className="h-16 text-3xl tracking-[0.5em] text-center"
                                />
                            </div>

                            <Button
                                onClick={handlePinSetup}
                                disabled={isLoading || pin.length !== 4 || confirmPin.length !== 4}
                                className="w-full h-14 text-lg font-semibold"
                            >
                                {isLoading ? <Loader2 className="animate-spin" /> : t.complete}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// Role selection button component
interface RoleButtonProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    selected: boolean;
    onClick: () => void;
    color: "orange" | "green" | "blue";
}

function RoleButton({ icon, title, description, selected, onClick, color }: RoleButtonProps) {
    const colors = {
        orange: "border-orange-500 bg-orange-50 text-orange-600",
        green: "border-green-500 bg-green-50 text-green-600",
        blue: "border-blue-500 bg-blue-50 text-blue-600",
    };

    const iconColors = {
        orange: "text-orange-500",
        green: "text-green-500",
        blue: "text-blue-500",
    };

    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${selected ? colors[color] : "border-gray-200 hover:border-gray-300"
                }`}
        >
            <div className={selected ? iconColors[color] : "text-gray-400"}>
                {icon}
            </div>
            <div className="flex-1">
                <div className="font-semibold">{title}</div>
                <div className="text-sm text-gray-500">{description}</div>
            </div>
        </button>
    );
}
