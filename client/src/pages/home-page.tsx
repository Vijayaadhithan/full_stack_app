import React, { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Mail,
  MapPin,
  Phone,
  Shield,
  Sparkles,
  UserCircle,
  Wrench,
  ShoppingBag,
  Zap,
  Home,
  Car,
  Scissors,
  Utensils,
  Shirt,
  Monitor,
  Heart,
  Users,
  Clock,
  Headphones,
  Store,
  ChevronDown,
  Globe,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import doorstepLogo from "@/assets/doorstep-ds-logo.png";

// Lazy load hero visuals - only loads on desktop
const LazyHeroVisuals = lazy(() => import("@/components/HeroVisuals"));

// Detect if user prefers reduced motion or is on mobile
const useReducedMotion = () => {
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mediaQuery.addEventListener("change", handler);

    // Check if mobile (< 768px or touch device)
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || "ontouchstart" in window);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      mediaQuery.removeEventListener("change", handler);
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  return prefersReduced || isMobile;
};

// Service categories
const serviceCategories = [
  { icon: Home, name: "Home Repairs", color: "from-blue-500 to-cyan-400" },
  { icon: Wrench, name: "Plumbing", color: "from-indigo-500 to-purple-400" },
  { icon: Zap, name: "Electrical", color: "from-amber-500 to-yellow-400" },
  { icon: Car, name: "Auto Services", color: "from-slate-500 to-gray-400" },
  { icon: Scissors, name: "Beauty & Salon", color: "from-pink-500 to-rose-400" },
  { icon: Utensils, name: "Catering", color: "from-orange-500 to-red-400" },
];

// Shop categories
const shopCategories = [
  { icon: ShoppingBag, name: "Groceries", color: "from-green-500 to-emerald-400", desc: "Fresh produce & essentials" },
  { icon: Shirt, name: "Fashion", color: "from-purple-500 to-violet-400", desc: "Clothing & accessories" },
  { icon: Monitor, name: "Electronics", color: "from-blue-500 to-indigo-400", desc: "Gadgets & appliances" },
  { icon: Utensils, name: "Food & Dining", color: "from-orange-500 to-amber-400", desc: "Restaurants & takeaway" },
];

// Values/Features
const values = [
  {
    icon: Heart,
    title: "Inclusive by Design",
    description: "Simple, accessible interface optimized for all devices. Low data usage means you can browse anywhere, anytime.",
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
  },
  {
    icon: Shield,
    title: "Verified Quality",
    description: "Every service provider and shop is manually verified to ensure you get the best experience possible.",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
  },
  {
    icon: Users,
    title: "Community First",
    description: "Supporting local businesses and skilled workers right in your neighborhood. We grow together.",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: Clock,
    title: "Quick Service",
    description: "Get services at your doorstep within hours. No long waits, just efficient and reliable help.",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
  },
  {
    icon: Globe,
    title: "Rural Focused",
    description: "Built specifically for rural communities in Tamil Nadu. Technology that understands your needs.",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
  {
    icon: Headphones,
    title: "24/7 Support",
    description: "Our support team is always available to help you with any issues or questions you may have.",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
  },
];

// Simple counter - animate only once on mount, use CSS transition
function StatCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (hasAnimated) return;

    // Use requestIdleCallback for non-blocking animation
    const startAnimation = () => {
      setHasAnimated(true);
      const duration = 1500;
      const steps = 30;
      const stepValue = value / steps;
      let current = 0;
      let step = 0;

      const animate = () => {
        step++;
        current = Math.min(Math.floor(stepValue * step), value);
        setCount(current);
        if (step < steps) {
          setTimeout(animate, duration / steps);
        }
      };

      // Delay start to not block initial render
      setTimeout(animate, 500);
    };

    if ('requestIdleCallback' in window) {
      (window as Window & typeof globalThis).requestIdleCallback(startAnimation);
    } else {
      setTimeout(startAnimation, 100);
    }
  }, [value, hasAnimated]);

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
            <StatCounter value={500} suffix="+" />
          </div>
          <div className="text-xs text-slate-500 mt-1">Service Providers</div>
        </div>
        <div className="text-center">
          <div className="text-2xl md:text-3xl font-bold text-white">
            <StatCounter value={200} suffix="+" />
          </div>
          <div className="text-xs text-slate-500 mt-1">Local Shops</div>
        </div>
        <div className="text-center">
          <div className="text-2xl md:text-3xl font-bold text-white">
            <StatCounter value={10000} suffix="+" />
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

        {/* Services Section */}
        <section id="services" className="py-24 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16 animate-fade-in-up">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-blue-500/10 text-blue-400 mb-6">
                <Wrench className="h-8 w-8" />
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Our Services</h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg">From home maintenance to beauty care, we connect you with trusted professionals who deliver quality work right at your doorstep.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {serviceCategories.map((service, index) => (
                <HoverCard key={index}>
                  <div className="group relative overflow-hidden rounded-2xl bg-slate-900/50 border border-white/5 p-6 hover:border-white/10 transition-all cursor-pointer text-center">
                    <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
                    <div className={`mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br ${service.color} flex items-center justify-center mb-4 shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}>
                      <service.icon className="h-7 w-7 text-white" />
                    </div>
                    <h3 className="font-semibold text-white text-sm">{service.name}</h3>
                  </div>
                </HoverCard>
              ))}
            </div>

            <div className="text-center mt-12">
              <Button asChild variant="outline" size="lg" className="rounded-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 transition-all duration-300">
                <Link href="/customer/browse-services">
                  View All Services <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Shops Section */}
        <section id="shops" className="py-24 bg-gradient-to-b from-slate-950 via-slate-900/50 to-slate-950 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-amber-500/10 text-amber-400 mb-6">
                <Store className="h-8 w-8" />
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Shop Local</h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg">Support your neighborhood businesses. Browse products from verified local shops and get them delivered to your doorstep.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {shopCategories.map((shop, index) => (
                <HoverCard key={index}>
                  <div className="group relative overflow-hidden rounded-3xl bg-slate-900/70 border border-white/5 p-6 hover:border-white/15 transition-all cursor-pointer">
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${shop.color} opacity-10 rounded-full blur-[40px] group-hover:opacity-25 transition-opacity`} />
                    <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${shop.color} flex items-center justify-center mb-5 shadow-lg transition-transform duration-300 group-hover:rotate-6`}>
                      <shop.icon className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{shop.name}</h3>
                    <p className="text-slate-400 text-sm">{shop.desc}</p>
                  </div>
                </HoverCard>
              ))}
            </div>

            <div className="text-center mt-12">
              <Button asChild variant="outline" size="lg" className="rounded-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 transition-all duration-300">
                <Link href="/customer/browse-products">
                  Browse All Products <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Feature/Inclusivity Section */}
        <section id="about" className="py-24 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-purple-500/10 text-purple-400 mb-6">
                <Heart className="h-8 w-8" />
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Built for Our Community</h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg">We believe in technology that empowers everyone. DoorStepTN is designed to be accessible, reliable, and trustworthy for all rural communities.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {values.map((value, index) => (
                <HoverCard key={index}>
                  <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all">
                    <div className={`h-14 w-14 rounded-2xl ${value.bgColor} flex items-center justify-center mb-6`}>
                      <value.icon className={`h-7 w-7 ${value.color}`} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{value.title}</h3>
                    <p className="text-slate-400 leading-relaxed">{value.description}</p>
                  </div>
                </HoverCard>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-6">
          <div className="mx-auto max-w-5xl relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-orange-500 to-amber-600 p-12 md:p-20">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[80px]" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-[60px]" />

            <div className="relative z-10 text-center">
              <div className={`inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-white/20 text-white mb-8 mx-auto ${reduceMotion ? '' : 'animate-spin-slow'}`}>
                <Sparkles className="h-10 w-10" />
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Ready to Get Started?</h2>
              <p className="text-orange-100 max-w-xl mx-auto text-lg mb-10">Join thousands of satisfied customers across Tamil Nadu. Experience the convenience of quality services and products at your doorstep.</p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button asChild size="lg" className="rounded-full bg-white text-orange-600 hover:bg-orange-50 shadow-2xl h-14 px-10 text-lg font-semibold transition-transform duration-300 hover:scale-105">
                  <Link href="/auth">
                    Create Free Account
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-full border-white/30 text-white hover:bg-white/10 h-14 px-10 text-lg transition-all duration-300">
                  <a href="#contact">Contact Us</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer / Contact */}
        <section id="contact" className="pt-16 pb-8 px-6 bg-slate-900/30">
          <div className="mx-auto max-w-7xl">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 pb-16 border-b border-white/5">
              {/* Brand */}
              <div className="lg:col-span-2">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-1 shadow-lg shadow-orange-500/10">
                    <img src={doorstepLogo} alt="Logo" className="h-full w-full rounded-xl object-cover" loading="lazy" />
                  </div>
                  <div>
                    <span className="text-2xl font-bold text-white">DoorStepTN</span>
                    <p className="text-xs text-slate-500 tracking-wider uppercase">Rural Marketplace</p>
                  </div>
                </div>
                <p className="text-slate-400 max-w-md mb-8 leading-relaxed">
                  Empowering local economies through reliable service delivery and digital connection. Bridging the gap between quality and convenience for every community in Tamil Nadu.
                </p>
                <div className="flex gap-4">
                  <Button asChild size="sm" className="rounded-full bg-orange-500 hover:bg-orange-600 transition-colors">
                    <Link href="/auth">Get Started</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="rounded-full border-slate-700 hover:bg-slate-800 transition-colors">
                    <Link href="/customer/browse-services">Browse Services</Link>
                  </Button>
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h4 className="font-bold text-white text-lg mb-6">Contact Us</h4>
                <ul className="space-y-4 text-sm text-slate-400">
                  <li className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-orange-400 mt-0.5 shrink-0" />
                    <div>
                      <div>+91 97895 46741</div>
                      <div>+91 95970 53683</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-orange-400 mt-0.5 shrink-0" />
                    <div>
                      <div>vjaadhi2799@gmail.com</div>
                      <div>vigneshwaran2513@gmail.com</div>
                    </div>
                  </li>
                  <li className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-orange-400 shrink-0" />
                    <span>Tamil Nadu, India</span>
                  </li>
                </ul>
              </div>

              {/* Legal & Credits */}
              <div>
                <h4 className="font-bold text-white text-lg mb-6">Legal & Links</h4>
                <ul className="space-y-3 text-sm text-slate-400">
                  <li>
                    <Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
                  </li>
                  <li>
                    <Link href="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link>
                  </li>
                  <li>
                    <Link href="/customer/browse-services" className="hover:text-white transition-colors">Browse Services</Link>
                  </li>
                  <li>
                    <Link href="/customer/browse-products" className="hover:text-white transition-colors">Browse Products</Link>
                  </li>
                </ul>
                <div className="mt-8 pt-6 border-t border-white/5">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Developed & Owned by<br />
                    <span className="text-slate-500 font-medium">Vijayaadhithan & Vigneshwaran</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-600">
                &copy; {new Date().getFullYear()} DoorStepTN. All rights reserved.
              </p>
              <div className="flex items-center gap-6 text-xs text-slate-600">
                <span>Made with ❤️ in Tamil Nadu</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}


