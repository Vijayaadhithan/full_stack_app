import React, { useEffect, useState, useRef } from "react";
// z from zod not used directly in this file
import { Loader2, ArrowLeft, Phone, Lock, Globe, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import doorstepLogo from "@/assets/doorstep-ds-logo.png";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  initRecaptcha,
  sendOTP,
  verifyOTP,
  cleanupRecaptcha,
} from "@/lib/firebase";
import type { RecaptchaVerifier } from "firebase/auth";

type ForgotPasswordStep = "phone" | "otp" | "new-password" | "success";

type ForgotPasswordProps = {
  language?: "en" | "ta";
  onLanguageChange?: (lang: "en" | "ta") => void;
  onClose: () => void;
};

// Translations for forgot password flow
const fpTranslations = {
  en: {
    title: "Reset PIN",
    subtitle: "Enter your phone number to reset",
    phoneLabel: "Your Mobile Number",
    sendOtp: "Send OTP",
    enterOtp: "Enter OTP",
    otpSentTo: "OTP sent to",
    verifyOtp: "Verify OTP",
    newPin: "New PIN",
    confirmPin: "Confirm PIN",
    resetPin: "Reset PIN",
    successTitle: "PIN Reset!",
    successMessage: "Your PIN has been successfully reset. You can now login with your new PIN.",
    backToLogin: "Back to Login",
    resendOtp: "Resend OTP",
    pinMismatch: "PINs do not match",
    pinInvalid: "PIN must be exactly 4 digits",
    invalidOtp: "Invalid OTP. Please try again.",
    otpExpired: "OTP expired. Please request a new one.",
  },
  ta: {
    title: "PIN மீட்டமைப்பு",
    subtitle: "மீட்டமைக்க உங்கள் மொபைல் எண்",
    phoneLabel: "உங்கள் மொபைல் எண்",
    sendOtp: "OTP அனுப்பு",
    enterOtp: "OTP உள்ளிடவும்",
    otpSentTo: "OTP அனுப்பப்பட்டது",
    verifyOtp: "OTP சரிபார்க்கவும்",
    newPin: "புதிய PIN",
    confirmPin: "PIN உறுதிப்படுத்து",
    resetPin: "PIN மீட்டமை",
    successTitle: "PIN மீட்டமைக்கப்பட்டது!",
    successMessage: "உங்கள் PIN வெற்றிகரமாக மீட்டமைக்கப்பட்டது. புதிய PIN உடன் உள்நுழையலாம்.",
    backToLogin: "உள்நுழைவுக்கு திரும்பு",
    resendOtp: "OTP மீண்டும் அனுப்பு",
    pinMismatch: "PIN கள் பொருந்தவில்லை",
    pinInvalid: "PIN 4 இலக்கங்கள் இருக்க வேண்டும்",
    invalidOtp: "தவறான OTP. மீண்டும் முயற்சிக்கவும்.",
    otpExpired: "OTP காலாவதியானது. புதியது கோரவும்.",
  },
};

export default function ForgotPassword({
  language = "en",
  onLanguageChange,
  onClose,
}: ForgotPasswordProps) {
  const { toast } = useToast();
  const [currentLang, setCurrentLang] = useState<"en" | "ta">(language);
  const fp = fpTranslations[currentLang];

  const [step, setStep] = useState<ForgotPasswordStep>("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [_showPassword, _setShowPassword] = useState(false);
  const [_showConfirmPassword, _setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otpInputRef = useRef<HTMLInputElement>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const sendOtpButtonId = "send-otp-button";
  const [recaptchaReady, setRecaptchaReady] = useState(false);

  // Initialize reCAPTCHA on mount
  useEffect(() => {
    if (step === "phone") {
      let cancelled = false;

      // Small delay to ensure DOM is ready, then initialize async
      const timer = setTimeout(async () => {
        try {
          const verifier = await initRecaptcha(sendOtpButtonId);
          if (!cancelled && verifier) {
            recaptchaRef.current = verifier;
            setRecaptchaReady(true);
            console.log("reCAPTCHA ready for use");
          }
        } catch (error) {
          console.error("Failed to initialize reCAPTCHA:", error);
          setRecaptchaReady(false);
        }
      }, 300);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    } else {
      setRecaptchaReady(false);
    }
  }, [step]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRecaptcha();
    };
  }, []);

  // Focus OTP input when step changes
  useEffect(() => {
    if (step === "otp" && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  // Handle phone submission - send OTP via Firebase
  async function handleSendOtp() {
    if (phone.length !== 10 || !/^\d{10}$/.test(phone)) {
      toast({ title: "Invalid phone", description: "Please enter 10 digits", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (!recaptchaRef.current || !recaptchaReady) {
        // Try to reinitialize reCAPTCHA
        const verifier = await initRecaptcha(sendOtpButtonId);
        if (verifier) {
          recaptchaRef.current = verifier;
          setRecaptchaReady(true);
        } else {
          toast({ title: "Error", description: "Security verification failed. Please refresh and try again.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
      }
      // Use Firebase Phone Auth for SMS OTP
      await sendOTP(phone, recaptchaRef.current);
      setStep("otp");
      toast({ title: "OTP Sent", description: `OTP sent to +91 ${phone}` });
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to send OTP. Please try again.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
      // Re-initialize reCAPTCHA on error
      cleanupRecaptcha();
      setRecaptchaReady(false);
      setTimeout(async () => {
        try {
          const verifier = await initRecaptcha(sendOtpButtonId);
          if (verifier) {
            recaptchaRef.current = verifier;
            setRecaptchaReady(true);
          }
        } catch (e) {
          console.error("Failed to reinitialize reCAPTCHA:", e);
        }
      }, 300);
    } finally {
      setIsLoading(false);
    }
  }

  // Handle OTP verification via Firebase
  async function handleVerifyOtp() {
    if (otp.length !== 6) {
      toast({ title: "Invalid OTP", description: "Please enter 6 digits", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Verify OTP with Firebase
      await verifyOTP(otp);
      setStep("new-password");
    } catch (err: any) {
      setError(err?.message || fp.invalidOtp);
    } finally {
      setIsLoading(false);
    }
  }

  // Handle PIN reset (Firebase verified the OTP, now we just reset the PIN)
  async function handleResetPassword() {
    if (newPassword.length !== 4 || !/^\d{4}$/.test(newPassword)) {
      setError(fp.pinInvalid);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(fp.pinMismatch);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call backend to reset PIN (phone is already verified via Firebase)
      const res = await apiRequest("POST", "/api/auth/reset-pin", {
        phone,
        newPin: newPassword,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to reset PIN");
        return;
      }

      setStep("success");
    } catch (err) {
      setError("Failed to reset PIN. Please try again.");
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
          {/* Language Selector */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => {
                const newLang = currentLang === "en" ? "ta" : "en";
                setCurrentLang(newLang);
                onLanguageChange?.(newLang);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md text-white/80 text-sm font-medium hover:bg-white/20 transition-all border border-white/10"
            >
              <Globe className="w-4 h-4" />
              {currentLang === "en" ? "தமிழ்" : "English"}
            </button>
          </div>

          {/* Glass Card */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-3xl blur-lg opacity-30 animate-pulse" />

            <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />

              {/* Back button (not shown on success) */}
              {step !== "success" && (
                <button
                  onClick={step === "phone" ? onClose : () => setStep("phone")}
                  className="relative flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {step === "phone" ? fp.backToLogin : fp.backToLogin}
                </button>
              )}

              {/* Header with DS Logo */}
              <div className="relative text-center mb-8">
                <div className="relative inline-block mb-6">
                  <div className="absolute -inset-4 bg-orange-500/30 rounded-full blur-2xl" />
                  <div className="relative w-20 h-20 mx-auto rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30 bg-white/10 p-1">
                    <img
                      src={doorstepLogo}
                      alt="DoorStep"
                      className="w-full h-full object-cover rounded-xl"
                    />
                  </div>
                </div>

                <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-300 via-amber-200 to-orange-300 bg-clip-text text-transparent mb-2">
                  {step === "success" ? fp.successTitle : fp.title}
                </h1>
                <p className="text-white/60 text-sm flex items-center justify-center gap-2">
                  {step === "success" ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : step === "phone" ? (
                    <Phone className="w-4 h-4" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  {step === "success"
                    ? fp.successMessage
                    : step === "otp"
                      ? `${fp.otpSentTo} +91 ${phone}`
                      : step === "new-password"
                        ? "Create a new secure password"
                        : fp.subtitle}
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300">
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* Step: Phone Entry */}
              {step === "phone" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-3">
                    <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {fp.phoneLabel}
                    </Label>
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
                      <div className="relative flex items-center bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
                        <span className="pl-4 pr-2 text-white/60 text-lg font-semibold">+91</span>
                        <Input
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={10}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          placeholder="9876543210"
                          className="flex-1 h-14 text-xl font-mono tracking-wider text-white placeholder:text-white/30 bg-transparent border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          autoComplete="tel"
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    id="send-otp-button"
                    onClick={handleSendOtp}
                    disabled={isLoading || phone.length !== 10}
                    className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl shadow-lg shadow-orange-500/30 transition-all duration-300 hover:shadow-orange-500/50 hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="animate-spin" /> : fp.sendOtp}
                  </Button>
                </div>
              )}

              {/* Step: OTP Entry */}
              {step === "otp" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-3">
                    <Label className="text-white/80 text-sm font-medium">{fp.enterOtp}</Label>
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
                  </div>

                  <Button
                    onClick={handleVerifyOtp}
                    disabled={isLoading || otp.length !== 6}
                    className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl shadow-lg shadow-orange-500/30"
                  >
                    {isLoading ? <Loader2 className="animate-spin" /> : fp.verifyOtp}
                  </Button>

                  <button
                    onClick={handleSendOtp}
                    disabled={isLoading}
                    className="w-full text-center text-white/50 text-sm hover:text-white/70 transition-colors"
                  >
                    {fp.resendOtp}
                  </button>
                </div>
              )}

              {/* Step: New PIN */}
              {step === "new-password" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-3">
                    <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      {fp.newPin}
                    </Label>
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
                      <Input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="• • • •"
                        className="relative h-16 text-3xl tracking-[0.5em] text-center text-white placeholder:text-white/30 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      {fp.confirmPin}
                    </Label>
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
                      <Input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="• • • •"
                        className="relative h-16 text-3xl tracking-[0.5em] text-center text-white placeholder:text-white/30 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleResetPassword}
                    disabled={isLoading || newPassword.length !== 4 || confirmPassword.length !== 4}
                    className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl shadow-lg shadow-orange-500/30"
                  >
                    {isLoading ? <Loader2 className="animate-spin" /> : fp.resetPin}
                  </Button>
                </div>
              )}

              {/* Step: Success */}
              {step === "success" && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 text-center">
                  <div className="w-20 h-20 mx-auto bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
                    <CheckCircle className="w-10 h-10 text-white" />
                  </div>

                  <p className="text-white/70 text-sm">{fp.successMessage}</p>

                  <Button
                    onClick={onClose}
                    className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl shadow-lg shadow-orange-500/30"
                  >
                    {fp.backToLogin}
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
