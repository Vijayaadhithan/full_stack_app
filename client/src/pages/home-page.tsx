import React, { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Shield,
  Sparkles,
  UserCircle,
  Wrench,
  ShoppingBag,
  Zap,
  Heart,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import doorstepLogo from "@/assets/doorstep-ds-logo.png";

// Lazy load hero visuals - only loads on desktop
const LazyHeroVisuals = lazy(() => import("@/components/HeroVisuals"));
const LazyHomePageBelowFold = lazy(() => import("@/pages/home-page-below-fold"));

// Detect if user prefers reduced motion or is on mobile
const useReducedMotion = () => {
  const getInitialPrefersReduced = () => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  };

  const getInitialIsMobile = () => {
    if (typeof window === "undefined") return false;
    const isCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    const touchPoints = typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0;
    return window.innerWidth < 768 || isCoarsePointer || touchPoints > 0 || "ontouchstart" in window;
  };

  const [prefersReduced, setPrefersReduced] = useState(getInitialPrefersReduced);
  const [isMobile, setIsMobile] = useState(getInitialIsMobile);

  useEffect(() => {
    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mediaQuery) {
      setPrefersReduced(mediaQuery.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
      if ("addEventListener" in mediaQuery) {
        mediaQuery.addEventListener("change", handler);
      } else if ("addListener" in mediaQuery) {
        mediaQuery.addListener(handler);
      }

      return () => {
        if ("removeEventListener" in mediaQuery) {
          mediaQuery.removeEventListener("change", handler);
        } else if ("removeListener" in mediaQuery) {
          mediaQuery.removeListener(handler);
        }
      };
    }
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      const isCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
      const touchPoints = typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0;
      setIsMobile(window.innerWidth < 768 || isCoarsePointer || touchPoints > 0 || "ontouchstart" in window);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  return prefersReduced || isMobile;
};

// Simple counter - animate only once on mount, use CSS transition
function StatCounter({
  value,
  suffix = "",
  animate = true,
}: {
  value: number;
  suffix?: string;
  animate?: boolean;
}) {
  const [count, setCount] = useState(animate ? 0 : value);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (!animate) {
      setCount(value);
      return;
    }
    if (hasAnimated) return;

    let idleHandle: number | undefined;
    let startTimeoutHandle: number | undefined;
    let stepTimeoutHandle: number | undefined;

    const startAnimation = () => {
      setHasAnimated(true);
      const duration = 1500;
      const steps = 30;
      const stepValue = value / steps;
      let current = 0;
      let step = 0;

      const animateStep = () => {
        step++;
        current = Math.min(Math.floor(stepValue * step), value);
        setCount(current);
        if (step < steps) {
          stepTimeoutHandle = window.setTimeout(animateStep, duration / steps);
        }
      };

      // Delay start to not block initial render
      stepTimeoutHandle = window.setTimeout(animateStep, 500);
    };

    if ("requestIdleCallback" in window) {
      idleHandle = (window as Window & typeof globalThis).requestIdleCallback(startAnimation);
    } else {
      startTimeoutHandle = window.setTimeout(startAnimation, 100);
    }

    return () => {
      if (typeof idleHandle === "number" && "cancelIdleCallback" in window) {
        (window as Window & typeof globalThis).cancelIdleCallback(idleHandle);
      }
      if (typeof startTimeoutHandle === "number") {
        window.clearTimeout(startTimeoutHandle);
      }
      if (typeof stepTimeoutHandle === "number") {
        window.clearTimeout(stepTimeoutHandle);
      }
    };
  }, [animate, value, hasAnimated]);

  return (
    <span className="tabular-nums">
      {count.toLocaleString()}{suffix}
    </span>
  );
}

// CSS-animated card wrapper for hover effects (no JS animation)
function HoverCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`transform transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.01] ${className}`}>
      {children}
    </div>
  );
}

export default function HomePage() {
  const reduceMotion = useReducedMotion();
  const [showBelowFold, setShowBelowFold] = useState(false);

  useEffect(() => {
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;
    let hasShown = false;

    const show = () => {
      if (hasShown) return;
      hasShown = true;
      setShowBelowFold(true);
      window.removeEventListener("scroll", onScroll);
    };

    const onScroll = () => {
      show();
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    if ("requestIdleCallback" in window) {
      idleHandle = (window as Window & typeof globalThis).requestIdleCallback(show, { timeout: 1500 });
    } else {
      timeoutHandle = window.setTimeout(show, 1200);
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (typeof idleHandle === "number" && "cancelIdleCallback" in window) {
        (window as Window & typeof globalThis).cancelIdleCallback(idleHandle);
      }
      if (typeof timeoutHandle === "number") {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, []);

  // Memoize static content to prevent re-renders
  const heroContent = useMemo(() => (
    <div className="space-y-8">
      <div className="inline-flex items-center rounded-full border border-orange-500/30 bg-gradient-to-r from-orange-500/20 to-amber-500/10 px-4 py-1.5 text-xs font-semibold text-orange-300 shadow-lg shadow-orange-500/10">
        <Sparkles className={`mr-2 h-4 w-4 ${reduceMotion ? '' : 'animate-spin-slow'}`} />
        Tamil Nadu's Trusted Rural Marketplace
      </div>

      <h1 className={`text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1] ${reduceMotion ? '' : 'animate-fade-in'}`}>
        Everything you need,
        <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500">
          delivered to your door.
        </span>
      </h1>

      <p className={`max-w-xl text-lg md:text-xl text-slate-400 leading-relaxed ${reduceMotion ? '' : 'animate-fade-in-delayed'}`}>
        Connect with verified local service providers and shops. From home repairs to daily essentials, we bridge the gap between quality and convenience for every community in Tamil Nadu.
      </p>

      <div className="flex flex-wrap gap-4">
        <Button
          asChild
          size="lg"
          className="rounded-full bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:from-orange-600 hover:to-amber-700 shadow-2xl shadow-orange-500/30 h-14 px-8 text-base font-semibold transition-all duration-300 hover:scale-105"
        >
          <Link href="/auth">
            Get Started Free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="rounded-full border-slate-700 bg-slate-900/50 text-slate-200 hover:bg-slate-800 hover:text-white hover:border-slate-600 h-14 px-8 text-base backdrop-blur-sm transition-all duration-300"
        >
          <a href="#services">
            Explore Services
            <ChevronDown className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>

      {/* Stats */}
      <div className="pt-8 grid grid-cols-3 gap-6">
        <div className="text-center">
          <div className="text-2xl md:text-3xl font-bold text-white">
            <StatCounter value={500} suffix="+" animate={!reduceMotion} />
          </div>
          <div className="text-xs text-slate-500 mt-1">Service Providers</div>
        </div>
        <div className="text-center">
          <div className="text-2xl md:text-3xl font-bold text-white">
            <StatCounter value={200} suffix="+" animate={!reduceMotion} />
          </div>
          <div className="text-xs text-slate-500 mt-1">Local Shops</div>
        </div>
        <div className="text-center">
          <div className="text-2xl md:text-3xl font-bold text-white">
            <StatCounter value={10000} suffix="+" animate={!reduceMotion} />
          </div>
          <div className="text-xs text-slate-500 mt-1">Happy Customers</div>
        </div>
      </div>

      <div className="pt-4 flex items-center gap-8 text-sm text-slate-500 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-400" />
          <span>Verified Partners</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <span>Quick Service</span>
        </div>
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-rose-400" />
          <span>Community Trusted</span>
        </div>
      </div>
    </div>
  ), [reduceMotion]);

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-orange-500/30 selection:text-orange-100 font-sans overflow-x-hidden">
      {/* Background Ambience - CSS only, no JS animations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-orange-500/15 via-orange-500/5 to-transparent" />
        <div className={`absolute -top-[20%] -right-[10%] w-[700px] h-[700px] rounded-full bg-orange-600/10 blur-[150px] ${reduceMotion ? '' : 'animate-pulse-slow'}`} />
        <div className={`absolute top-[30%] -left-[15%] w-[600px] h-[600px] rounded-full bg-amber-500/10 blur-[120px] ${reduceMotion ? '' : 'animate-pulse-slower'}`} />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/70 backdrop-blur-2xl animate-fade-in-down">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative h-11 w-11 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-0.5 shadow-lg shadow-orange-500/10 transition-transform duration-300 group-hover:scale-105">
              <img
                src={doorstepLogo}
                alt="DoorStepTN"
                className="h-full w-full rounded-lg object-cover"
                loading="eager"
                decoding="async"
                fetchPriority="high"
                width={44}
                height={44}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-orange-400 transition-colors">
                DoorStepTN
              </span>
              <span className="text-[10px] text-slate-500 tracking-wider uppercase">Rural Marketplace</span>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-10 text-sm font-medium text-slate-300">
            <a href="#services" className="hover:text-orange-400 transition-colors hover:-translate-y-0.5 transform duration-200">Services</a>
            <a href="#shops" className="hover:text-orange-400 transition-colors hover:-translate-y-0.5 transform duration-200">Shops</a>
            <a href="#about" className="hover:text-orange-400 transition-colors hover:-translate-y-0.5 transform duration-200">About Us</a>
            <a href="#contact" className="hover:text-orange-400 transition-colors hover:-translate-y-0.5 transform duration-200">Contact</a>
          </div>

          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              className="hidden sm:inline-flex text-slate-300 hover:text-white hover:bg-white/5"
            >
              <Link href="/customer/browse-services">
                <Wrench className="h-4 w-4 mr-2" />
                Services
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="hidden sm:inline-flex text-slate-300 hover:text-white hover:bg-white/5"
            >
              <Link href="/customer/browse-products">
                <ShoppingBag className="h-4 w-4 mr-2" />
                Products
              </Link>
            </Button>
            <Button
              asChild
              variant="default"
              className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white border-0 shadow-lg shadow-orange-500/25 rounded-full px-6 h-10 transition-transform duration-300 hover:scale-105"
            >
              <Link href="/auth">
                <UserCircle className="h-4 w-4 mr-2" />
                Login
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-24">
        {/* Hero Section */}
        <section className="relative mx-auto max-w-7xl px-6 py-16 md:py-28 lg:py-36">
          <div className="grid gap-16 lg:grid-cols-2 items-center">
            {heroContent}

            {/* Hero Visual - Lazy loaded, hidden on mobile */}
            {!reduceMotion && (
              <Suspense fallback={
                <div className="relative hidden lg:block">
                  <div className="relative z-10 grid grid-cols-2 gap-5">
                    <div className="space-y-5 pt-12">
                      <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/5 animate-pulse"><div className="h-12 w-12 rounded-xl bg-slate-800 mb-4" /><div className="h-5 w-24 bg-slate-800 rounded mb-2" /><div className="h-4 w-32 bg-slate-800/60 rounded" /></div>
                      <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/5 animate-pulse"><div className="h-12 w-12 rounded-xl bg-slate-800 mb-4" /><div className="h-5 w-24 bg-slate-800 rounded mb-2" /><div className="h-4 w-32 bg-slate-800/60 rounded" /></div>
                    </div>
                    <div className="space-y-5">
                      <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/5 animate-pulse"><div className="h-12 w-12 rounded-xl bg-slate-800 mb-4" /><div className="h-5 w-24 bg-slate-800 rounded mb-2" /><div className="h-4 w-32 bg-slate-800/60 rounded" /></div>
                      <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/5 animate-pulse"><div className="h-12 w-12 rounded-xl bg-slate-800 mb-4" /><div className="h-5 w-24 bg-slate-800 rounded mb-2" /><div className="h-4 w-32 bg-slate-800/60 rounded" /></div>
                    </div>
                  </div>
                </div>
              }>
                <LazyHeroVisuals />
              </Suspense>
            )}
          </div>
        </section>

        {/* Quick Access Grid */}
        <section className="mx-auto max-w-7xl px-6 pb-24">
          <div className="grid md:grid-cols-2 gap-6">
            <Link href="/customer/browse-services">
              <HoverCard>
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-900/80 border border-white/10 p-8 md:p-10 hover:border-blue-500/30 transition-all cursor-pointer h-full">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[80px] group-hover:bg-blue-500/25 transition-all duration-500" />
                  <div className="relative z-10">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30 transition-transform duration-300 group-hover:rotate-6">
                      <Wrench className="h-7 w-7" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">Browse Services</h3>
                    <p className="text-slate-400 mb-6 text-lg">Find skilled professionals for repairs, cleaning, beauty, tutoring and more.</p>
                    <span className="inline-flex items-center text-blue-400 font-semibold text-lg group-hover:translate-x-2 transition-transform">
                      Find a Pro <ArrowRight className="ml-2 h-5 w-5" />
                    </span>
                  </div>
                </div>
              </HoverCard>
            </Link>

            <Link href="/customer/browse-products">
              <HoverCard>
                <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-900/80 border border-white/10 p-8 md:p-10 hover:border-amber-500/30 transition-all cursor-pointer h-full">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-[80px] group-hover:bg-amber-500/25 transition-all duration-500" />
                  <div className="relative z-10">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-400 text-white flex items-center justify-center mb-6 shadow-lg shadow-amber-500/30 transition-transform duration-300 group-hover:rotate-6">
                      <ShoppingBag className="h-7 w-7" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">Browse Products</h3>
                    <p className="text-slate-400 mb-6 text-lg">Order essentials, food, electronics, and fashion from trusted local stores.</p>
                    <span className="inline-flex items-center text-amber-400 font-semibold text-lg group-hover:translate-x-2 transition-transform">
                      Start Shopping <ArrowRight className="ml-2 h-5 w-5" />
                    </span>
                  </div>
                </div>
              </HoverCard>
            </Link>
          </div>
        </section>

        {showBelowFold ? (
          <Suspense fallback={<div className="min-h-[80vh]" />}>
            <LazyHomePageBelowFold reduceMotion={reduceMotion} />
          </Suspense>
        ) : (
          <div className="min-h-[80vh]" />
        )}
      </main>
    </div>
  );
}
