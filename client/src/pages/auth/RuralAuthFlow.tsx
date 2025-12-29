import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Loader2, Phone, Lock, User, ArrowLeft, Store, Wrench, UserCircle, Globe, Sparkles, Shield, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import doorstepLogo from "@/assets/doorstep-ds-logo.png";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthStep = "phone" | "otp" | "pin-entry" | "pin-setup" | "profile-setup";
type Language = "en" | "ta";

interface RuralAuthFlowProps {
    onSuccess?: () => void;
    onForgotPassword?: () => void;
}

// Bilingual translations
const translations = {
    en: {
        enterPhone: "Enter your mobile number",
        phonePlaceholder: "9876543210",
        getOtp: "Continue",
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
        complete: "Complete Setup",
        switchLang: "தமிழ்",
        tagline: "Your local services, delivered",
    },
    ta: {
        enterPhone: "உங்கள் மொபைல் எண்",
        phonePlaceholder: "9876543210",
        getOtp: "தொடரவும்",
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
        complete: "அமைப்பை முடிக்கவும்",
        switchLang: "English",
        tagline: "உங்கள் உள்ளூர் சேவைகள்",
    },
};

export default function RuralAuthFlow({ onSuccess, onForgotPassword }: RuralAuthFlowProps) {
    const [, setLocation] = useLocation();
    const { toast } = useToast();

    // Language state - default to English
    const [language, setLanguage] = useState<Language>("en");
    const t = translations[language];

    // Auth state
    const [step, setStep] = useState<AuthStep>("phone");
    const [isLoading, setIsLoading] = useState(false);
    const [_isExistingUser, setIsExistingUser] = useState(false);
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

            localStorage.setItem("lastPhone", phone);

            if (data.exists) {
                setIsExistingUser(true);
                setUserName(data.name || "");
                setStep("pin-entry");
            } else {
                setIsExistingUser(false);
                setStep("otp");
            }
        } catch (error) {
            toast({ title: "Error", description: "Could not check phone number", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }

    // Handle OTP verification
    async function handleOtpVerify() {
        if (otp.length !== 6) {
            toast({ title: "Invalid OTP", description: "Please enter 6 digits", variant: "destructive" });
            return;
        }

        setIsLoading(true);
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

    // Handle forgot PIN - redirect to forgot password flow
    function handleForgotPin() {
        if (onForgotPassword) {
            onForgotPassword();
        } else {
            // Fallback: trigger OTP flow for legacy behavior
            setStep("otp");
        }
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

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />

            {/* Animated orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -left-40 w-80 h-80 bg-orange-500/30 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute top-1/3 -right-20 w-96 h-96 bg-amber-500/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
                <div className="absolute -bottom-40 left-1/3 w-80 h-80 bg-orange-600/25 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "2s" }} />
                <div className="absolute top-20 right-1/4 w-64 h-64 bg-yellow-500/15 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "1.5s" }} />
            </div>

            {/* Subtle grid pattern */}
            <div
                className="absolute inset-0 opacity-[0.02]"
                style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                      linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                    backgroundSize: '50px 50px'
                }}
            />

            {/* Main content */}
            <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    {/* Language Selector - Floating */}
                    <div className="flex justify-end mb-4">
                        <button
                            onClick={() => setLanguage(language === "en" ? "ta" : "en")}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md text-white/80 text-sm font-medium hover:bg-white/20 transition-all border border-white/10"
                        >
                            <Globe className="w-4 h-4" />
                            {t.switchLang}
                        </button>
                    </div>

                    {/* Glass Card */}
                    <div className="relative">
                        {/* Glow effect behind card */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-3xl blur-lg opacity-30 animate-pulse" />

                        <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8 overflow-hidden">
                            {/* Inner glow */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />

                            {/* Header with Logo */}
                            <div className="relative text-center mb-8">
                                {/* Logo with glow */}
                                <div className="relative inline-block mb-6">
                                    <div className="absolute -inset-4 bg-orange-500/30 rounded-full blur-2xl" />
                                    {/* Main Logo */}
                                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30 bg-white/10 p-1">
                                        <img
                                            src={doorstepLogo}
                                            alt="DoorStep"
                                            className="w-full h-full object-cover rounded-xl"
                                        />
                                    </div>
                                </div>

                                {/* Title */}
                                <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-300 via-amber-200 to-orange-300 bg-clip-text text-transparent mb-2">
                                    {step === "pin-entry" && userName
                                        ? (language === "en" ? `Hello, ${userName}!` : `வணக்கம், ${userName}!`)
                                        : "DoorStep"}
                                </h1>
                                <p className="text-white/60 text-sm flex items-center justify-center gap-2">
                                    <Sparkles className="w-4 h-4" />
                                    {t.tagline}
                                </p>
                            </div>

                            {/* Step: Phone Entry */}
                            {step === "phone" && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="space-y-3">
                                        <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
                                            <Phone className="w-4 h-4" />
                                            {t.enterPhone}
                                        </Label>
                                        <div className="relative group">
                                            <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
                                            <div className="relative flex items-center bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
                                                <span className="pl-4 pr-2 text-white/60 text-lg font-semibold">+91</span>
                                                <Input
                                                    ref={phoneInputRef}
                                                    type="tel"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    maxLength={10}
                                                    value={phone}
                                                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                                    placeholder={t.phonePlaceholder}
                                                    className="flex-1 h-14 text-xl font-mono tracking-wider text-white placeholder:text-white/30 bg-transparent border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                                    autoComplete="tel"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handlePhoneSubmit}
                                        disabled={isLoading || phone.length !== 10}
                                        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl shadow-lg shadow-orange-500/30 transition-all duration-300 hover:shadow-orange-500/50 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="animate-spin" />
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                {t.getOtp}
                                                <ChevronRight className="w-5 h-5" />
                                            </span>
                                        )}
                                    </Button>

                                    {/* Trust indicators */}
                                    <div className="flex items-center justify-center gap-4 text-white/40 text-xs">
                                        <span className="flex items-center gap-1">
                                            <Shield className="w-3 h-3" />
                                            Secure
                                        </span>
                                        <span>•</span>
                                        <span>100% Safe</span>
                                    </div>
                                </div>
                            )}

                            {/* Step: OTP Verification */}
                            {step === "otp" && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <button
                                        onClick={() => setStep("phone")}
                                        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        {t.back}
                                    </button>

                                    <div className="space-y-2">
                                        <Label className="text-white/80 text-sm font-medium">{t.enterOtp}</Label>
                                        <p className="text-white/50 text-sm">
                                            {language === "en" ? `OTP sent to +91 ${phone}` : `+91 ${phone} க்கு OTP அனுப்பப்பட்டது`}
                                        </p>
                                    </div>

                                    <div className="relative group">
                                        <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
                                        <Input
                                            ref={otpInputRef}
                                            type="tel"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            maxLength={6}
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                            placeholder="• • • • • •"
                                            className="relative h-16 text-2xl font-mono tracking-[0.5em] text-center text-white placeholder:text-white/30 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                        />
                                    </div>

                                    <Button
                                        onClick={handleOtpVerify}
                                        disabled={isLoading || otp.length !== 6}
                                        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl shadow-lg shadow-orange-500/30"
                                    >
                                        {isLoading ? <Loader2 className="animate-spin" /> : t.verify}
                                    </Button>
                                </div>
                            )}

                            {/* Step: PIN Entry (Existing User) */}
                            {step === "pin-entry" && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <button
                                        onClick={() => setStep("phone")}
                                        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        {t.back}
                                    </button>

                                    <div className="space-y-2">
                                        <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
                                            <Lock className="w-4 h-4" />
                                            {t.enterPin}
                                        </Label>
                                    </div>

                                    {/* PIN Dots Display */}
                                    <div className="flex justify-center gap-4 my-6">
                                        {[0, 1, 2, 3].map((i) => (
                                            <div
                                                key={i}
                                                className={`w-5 h-5 rounded-full transition-all duration-200 ${pin.length > i
                                                    ? "bg-gradient-to-r from-orange-400 to-amber-400 scale-110 shadow-lg shadow-orange-500/50"
                                                    : "bg-white/20"
                                                    }`}
                                            />
                                        ))}
                                    </div>

                                    <div className="relative group">
                                        <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
                                        <Input
                                            ref={pinInputRef}
                                            type="password"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            maxLength={4}
                                            value={pin}
                                            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                            placeholder="• • • •"
                                            className="relative h-16 text-3xl tracking-[0.5em] text-center text-white placeholder:text-white/30 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                        />
                                    </div>

                                    <Button
                                        onClick={handlePinLogin}
                                        disabled={isLoading || pin.length !== 4}
                                        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl shadow-lg shadow-orange-500/30"
                                    >
                                        {isLoading ? <Loader2 className="animate-spin" /> : t.login}
                                    </Button>

                                    <button
                                        onClick={handleForgotPin}
                                        disabled={isLoading}
                                        className="w-full text-center text-white/50 text-sm hover:text-white/70 transition-colors"
                                    >
                                        {t.forgotPin}
                                    </button>
                                </div>
                            )}

                            {/* Step: Profile Setup (New User) */}
                            {step === "profile-setup" && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <button
                                        onClick={() => setStep("otp")}
                                        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-2"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        {t.back}
                                    </button>

                                    <div className="space-y-3">
                                        <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
                                            <User className="w-4 h-4" />
                                            {t.yourName}
                                        </Label>
                                        <div className="relative group">
                                            <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
                                            <Input
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder={language === "en" ? "Your name" : "உங்கள் பெயர்"}
                                                className="relative h-14 text-lg text-white placeholder:text-white/30 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-white/80 text-sm font-medium">{t.chooseRole}</Label>
                                        <div className="grid gap-3">
                                            <RoleButton
                                                icon={<UserCircle className="w-7 h-7" />}
                                                title={t.customer}
                                                description={t.customerDesc}
                                                selected={selectedRole === "customer"}
                                                onClick={() => setSelectedRole("customer")}
                                                color="orange"
                                            />
                                            <RoleButton
                                                icon={<Store className="w-7 h-7" />}
                                                title={t.shop}
                                                description={t.shopDesc}
                                                selected={selectedRole === "shop"}
                                                onClick={() => setSelectedRole("shop")}
                                                color="green"
                                            />
                                            <RoleButton
                                                icon={<Wrench className="w-7 h-7" />}
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
                                        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl shadow-lg shadow-orange-500/30"
                                    >
                                        {t.next}
                                    </Button>
                                </div>
                            )}

                            {/* Step: PIN Setup (New User) */}
                            {step === "pin-setup" && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <button
                                        onClick={() => setStep("profile-setup")}
                                        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-2"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        {t.back}
                                    </button>

                                    <div className="space-y-3">
                                        <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
                                            <Lock className="w-4 h-4" />
                                            {t.createPin}
                                        </Label>
                                        <div className="relative group">
                                            <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
                                            <Input
                                                type="password"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                maxLength={4}
                                                value={pin}
                                                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                                placeholder="• • • •"
                                                className="relative h-16 text-3xl tracking-[0.5em] text-center text-white placeholder:text-white/30 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-white/80 text-sm font-medium">{t.confirmPin}</Label>
                                        <div className="relative group">
                                            <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
                                            <Input
                                                type="password"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                maxLength={4}
                                                value={confirmPin}
                                                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                                placeholder="• • • •"
                                                className="relative h-16 text-3xl tracking-[0.5em] text-center text-white placeholder:text-white/30 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handlePinSetup}
                                        disabled={isLoading || pin.length !== 4 || confirmPin.length !== 4}
                                        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl shadow-lg shadow-orange-500/30"
                                    >
                                        {isLoading ? <Loader2 className="animate-spin" /> : t.complete}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
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
    const gradients = {
        orange: "from-orange-500 to-amber-500",
        green: "from-emerald-500 to-green-500",
        blue: "from-blue-500 to-cyan-500",
    };

    return (
        <button
            type="button"
            onClick={onClick}
            className={`relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left overflow-hidden group ${selected
                ? "border-transparent"
                : "border-white/20 hover:border-white/40 bg-white/5"
                }`}
        >
            {/* Selected gradient background */}
            {selected && (
                <div className={`absolute inset-0 bg-gradient-to-r ${gradients[color]} opacity-20`} />
            )}

            {/* Selected border glow */}
            {selected && (
                <div className={`absolute -inset-[1px] bg-gradient-to-r ${gradients[color]} rounded-xl`} />
            )}

            <div className={`relative z-10 flex items-center gap-4 ${selected ? "text-white" : "text-white/70"}`}>
                <div className={`p-2 rounded-lg ${selected ? `bg-gradient-to-r ${gradients[color]}` : "bg-white/10"}`}>
                    {icon}
                </div>
                <div className="flex-1">
                    <div className="font-semibold">{title}</div>
                    <div className="text-sm text-white/50">{description}</div>
                </div>
                {selected && (
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-r ${gradients[color]} flex items-center justify-center`}>
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Background for selected state */}
            {selected && (
                <div className="absolute inset-[2px] bg-slate-900/90 rounded-[10px] -z-0" />
            )}
        </button>
    );
}
