import React, { useEffect, useState } from "react";
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
  Star,
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
import { motion, useScroll, useTransform } from "framer-motion";

import { Button } from "@/components/ui/button";
import doorstepLogo from "@/assets/doorstep-ds-logo.png";

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
};

const fadeInRight = {
  hidden: { opacity: 0, x: 60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: "easeOut" } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

const floatAnimation = {
  y: [-10, 10, -10],
  transition: {
    duration: 4,
    repeat: Infinity,
    ease: "easeInOut",
  },
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

// Floating particles component
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-orange-500/30 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.8, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 3 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 2,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// Animated text component
function AnimatedText({ text, className }: { text: string; className?: string }) {
  return (
    <motion.span
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.03,
          },
        },
      }}
      className={className}
    >
      {text.split("").map((char, i) => (
        <motion.span
          key={i}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 },
          }}
          className="inline-block"
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </motion.span>
  );
}

// Stats counter component
function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const stepValue = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += stepValue;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <span className="tabular-nums">
      {count.toLocaleString()}{suffix}
    </span>
  );
}

export default function HomePage() {
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0.3]);
  const heroScale = useTransform(scrollY, [0, 300], [1, 0.95]);

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-orange-500/30 selection:text-orange-100 font-sans overflow-x-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-orange-500/15 via-orange-500/5 to-transparent" />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[20%] -right-[10%] w-[700px] h-[700px] rounded-full bg-orange-600/10 blur-[150px]"
        />
        <motion.div
          animate={{
            scale: [1.1, 1, 1.1],
            opacity: [0.08, 0.15, 0.08],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[30%] -left-[15%] w-[600px] h-[600px] rounded-full bg-amber-500/10 blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.05, 0.1, 0.05],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[100px]"
        />
        <FloatingParticles />
      </div>

      {/* Navigation */}
      <motion.nav
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/70 backdrop-blur-2xl"
      >
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              className="relative h-11 w-11 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-0.5 shadow-lg shadow-orange-500/10"
            >
              <img
                src={doorstepLogo}
                alt="DoorStepTN"
                className="h-full w-full rounded-lg object-cover"
              />
            </motion.div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-orange-400 transition-colors">
                DoorStepTN
              </span>
              <span className="text-[10px] text-slate-500 tracking-wider uppercase">Rural Marketplace</span>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-10 text-sm font-medium text-slate-300">
            <motion.a whileHover={{ y: -2 }} href="#services" className="hover:text-orange-400 transition-colors">Services</motion.a>
            <motion.a whileHover={{ y: -2 }} href="#shops" className="hover:text-orange-400 transition-colors">Shops</motion.a>
            <motion.a whileHover={{ y: -2 }} href="#about" className="hover:text-orange-400 transition-colors">About Us</motion.a>
            <motion.a whileHover={{ y: -2 }} href="#contact" className="hover:text-orange-400 transition-colors">Contact</motion.a>
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
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                asChild
                variant="default"
                className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white border-0 shadow-lg shadow-orange-500/25 rounded-full px-6 h-10"
              >
                <Link href="/auth">
                  <UserCircle className="h-4 w-4 mr-2" />
                  Login
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.nav>

      <main className="relative z-10 pt-24">
        {/* Hero Section */}
        <motion.section
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative mx-auto max-w-7xl px-6 py-16 md:py-28 lg:py-36"
        >
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="grid gap-16 lg:grid-cols-2 items-center"
          >
            <div className="space-y-8">
              <motion.div
                variants={fadeInUp}
                className="inline-flex items-center rounded-full border border-orange-500/30 bg-gradient-to-r from-orange-500/20 to-amber-500/10 px-4 py-1.5 text-xs font-semibold text-orange-300 shadow-lg shadow-orange-500/10"
              >
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>
                  <Sparkles className="mr-2 h-4 w-4" />
                </motion.div>
                Tamil Nadu's Trusted Rural Marketplace
              </motion.div>

              <motion.h1 variants={fadeInUp} className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
                <AnimatedText text="Everything you need," />
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 animate-gradient">
                  delivered to your door.
                </span>
              </motion.h1>

              <motion.p variants={fadeInUp} className="max-w-xl text-lg md:text-xl text-slate-400 leading-relaxed">
                Connect with verified local service providers and shops. From home repairs to daily essentials, we bridge the gap between quality and convenience for every community in Tamil Nadu.
              </motion.p>

              <motion.div variants={fadeInUp} className="flex flex-wrap gap-4">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:from-orange-600 hover:to-amber-700 shadow-2xl shadow-orange-500/30 h-14 px-8 text-base font-semibold"
                  >
                    <Link href="/auth">
                      Get Started Free
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="rounded-full border-slate-700 bg-slate-900/50 text-slate-200 hover:bg-slate-800 hover:text-white hover:border-slate-600 h-14 px-8 text-base backdrop-blur-sm"
                  >
                    <a href="#services">
                      Explore Services
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </motion.div>
              </motion.div>

              {/* Stats */}
              <motion.div variants={fadeInUp} className="pt-8 grid grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">
                    <AnimatedCounter value={500} suffix="+" />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Service Providers</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">
                    <AnimatedCounter value={200} suffix="+" />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Local Shops</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">
                    <AnimatedCounter value={10000} suffix="+" />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Happy Customers</div>
                </div>
              </motion.div>

              <motion.div variants={fadeInUp} className="pt-4 flex items-center gap-8 text-sm text-slate-500 flex-wrap">
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
              </motion.div>
            </div>

            <motion.div variants={fadeInRight} className="relative hidden lg:block">
              {/* Hero Visual */}
              <div className="relative z-10 grid grid-cols-2 gap-5">
                <motion.div animate={floatAnimation} className="space-y-5 pt-12">
                  <motion.div
                    whileHover={{ scale: 1.02, y: -5 }}
                    className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 backdrop-blur-xl shadow-2xl shadow-blue-500/10"
                  >
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mb-4">
                      <Wrench className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="font-bold text-white text-lg">Expert Services</h3>
                    <p className="text-sm text-slate-400 mt-2">Plumbers, Electricians, Carpenters & more ready to help.</p>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.02, y: -5 }}
                    className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 backdrop-blur-xl shadow-2xl shadow-purple-500/10"
                  >
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-400 flex items-center justify-center mb-4">
                      <ShoppingBag className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="font-bold text-white text-lg">Local Shops</h3>
                    <p className="text-sm text-slate-400 mt-2">Groceries, Fashion & Electronics from nearby stores.</p>
                  </motion.div>
                </motion.div>
                <motion.div
                  animate={{
                    y: [10, -10, 10],
                    transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                  }}
                  className="space-y-5"
                >
                  <motion.div
                    whileHover={{ scale: 1.02, y: -5 }}
                    className="p-5 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 border border-orange-400/30 shadow-2xl shadow-orange-500/20 text-white"
                  >
                    <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
                      <Star className="h-6 w-6 text-white fill-white" />
                    </div>
                    <h3 className="font-bold text-xl">Top Rated</h3>
                    <p className="text-sm text-orange-100 mt-2">Quality you can trust, reviewed by your community.</p>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.02, y: -5 }}
                    className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 backdrop-blur-xl shadow-2xl shadow-emerald-500/10"
                  >
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 flex items-center justify-center mb-4">
                      <SmartphoneIcon />
                    </div>
                    <h3 className="font-bold text-white text-lg">Digital Access</h3>
                    <p className="text-sm text-slate-400 mt-2">Easy booking via phone or web. Simple & accessible.</p>
                  </motion.div>
                </motion.div>
              </div>

              {/* Decorative Background */}
              <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/20 via-purple-500/10 to-blue-500/20 rounded-full blur-[100px] -z-10" />
            </motion.div>
          </motion.div>
        </motion.section>

        {/* Quick Access Grid */}
        <section className="mx-auto max-w-7xl px-6 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="grid md:grid-cols-2 gap-6"
          >
            <Link href="/customer/browse-services">
              <motion.div
                whileHover={{ y: -5, scale: 1.01 }}
                className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-900/80 border border-white/10 p-8 md:p-10 hover:border-blue-500/30 transition-all cursor-pointer h-full"
              >
                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[80px] group-hover:bg-blue-500/25 transition-all duration-500" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-cyan-500/5 rounded-full blur-[40px] group-hover:bg-cyan-500/15 transition-all duration-500" />
                <div className="relative z-10">
                  <motion.div
                    whileHover={{ rotate: 10 }}
                    className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30"
                  >
                    <Wrench className="h-7 w-7" />
                  </motion.div>
                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">Browse Services</h3>
                  <p className="text-slate-400 mb-6 text-lg">Find skilled professionals for repairs, cleaning, beauty, tutoring and more.</p>
                  <span className="inline-flex items-center text-blue-400 font-semibold text-lg group-hover:translate-x-2 transition-transform">
                    Find a Pro <ArrowRight className="ml-2 h-5 w-5" />
                  </span>
                </div>
              </motion.div>
            </Link>

            <Link href="/customer/browse-products">
              <motion.div
                whileHover={{ y: -5, scale: 1.01 }}
                className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-900/80 border border-white/10 p-8 md:p-10 hover:border-amber-500/30 transition-all cursor-pointer h-full"
              >
                <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-[80px] group-hover:bg-amber-500/25 transition-all duration-500" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-orange-500/5 rounded-full blur-[40px] group-hover:bg-orange-500/15 transition-all duration-500" />
                <div className="relative z-10">
                  <motion.div
                    whileHover={{ rotate: 10 }}
                    className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-400 text-white flex items-center justify-center mb-6 shadow-lg shadow-amber-500/30"
                  >
                    <ShoppingBag className="h-7 w-7" />
                  </motion.div>
                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">Browse Products</h3>
                  <p className="text-slate-400 mb-6 text-lg">Order essentials, food, electronics, and fashion from trusted local stores.</p>
                  <span className="inline-flex items-center text-amber-400 font-semibold text-lg group-hover:translate-x-2 transition-transform">
                    Start Shopping <ArrowRight className="ml-2 h-5 w-5" />
                  </span>
                </div>
              </motion.div>
            </Link>
          </motion.div>
        </section>

        {/* Services Section */}
        <section id="services" className="py-24 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          <div className="mx-auto max-w-7xl px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-blue-500/10 text-blue-400 mb-6"
              >
                <Wrench className="h-8 w-8" />
              </motion.div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Our Services</h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg">From home maintenance to beauty care, we connect you with trusted professionals who deliver quality work right at your doorstep.</p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
            >
              {serviceCategories.map((service, index) => (
                <motion.div
                  key={index}
                  variants={scaleIn}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="group relative overflow-hidden rounded-2xl bg-slate-900/50 border border-white/5 p-6 hover:border-white/10 transition-all cursor-pointer text-center"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
                  <motion.div
                    whileHover={{ rotate: 10, scale: 1.1 }}
                    className={`mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br ${service.color} flex items-center justify-center mb-4 shadow-lg`}
                  >
                    <service.icon className="h-7 w-7 text-white" />
                  </motion.div>
                  <h3 className="font-semibold text-white text-sm">{service.name}</h3>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mt-12"
            >
              <Button asChild variant="outline" size="lg" className="rounded-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300">
                <Link href="/customer/browse-services">
                  View All Services <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Shops Section */}
        <section id="shops" className="py-24 bg-gradient-to-b from-slate-950 via-slate-900/50 to-slate-950 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
          <div className="mx-auto max-w-7xl px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-amber-500/10 text-amber-400 mb-6"
              >
                <Store className="h-8 w-8" />
              </motion.div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Shop Local</h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg">Support your neighborhood businesses. Browse products from verified local shops and get them delivered to your doorstep.</p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {shopCategories.map((shop, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  whileHover={{ y: -10 }}
                  className="group relative overflow-hidden rounded-3xl bg-slate-900/70 border border-white/5 p-6 hover:border-white/15 transition-all cursor-pointer"
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${shop.color} opacity-10 rounded-full blur-[40px] group-hover:opacity-25 transition-opacity`} />
                  <motion.div
                    whileHover={{ rotate: 10 }}
                    className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${shop.color} flex items-center justify-center mb-5 shadow-lg`}
                  >
                    <shop.icon className="h-8 w-8 text-white" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-white mb-2">{shop.name}</h3>
                  <p className="text-slate-400 text-sm">{shop.desc}</p>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mt-12"
            >
              <Button asChild variant="outline" size="lg" className="rounded-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300">
                <Link href="/customer/browse-products">
                  Browse All Products <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Feature/Inclusivity Section */}
        <section id="about" className="py-24 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
          <div className="mx-auto max-w-7xl px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-purple-500/10 text-purple-400 mb-6"
              >
                <Heart className="h-8 w-8" />
              </motion.div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Built for Our Community</h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg">We believe in technology that empowers everyone. DoorStepTN is designed to be accessible, reliable, and trustworthy for all rural communities.</p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {values.map((value, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  whileHover={{ y: -5 }}
                  className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all"
                >
                  <div className={`h-14 w-14 rounded-2xl ${value.bgColor} flex items-center justify-center mb-6`}>
                    <value.icon className={`h-7 w-7 ${value.color}`} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{value.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{value.description}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mx-auto max-w-5xl relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-orange-500 to-amber-600 p-12 md:p-20"
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[80px]" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-[60px]" />

            <div className="relative z-10 text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-white/20 text-white mb-8 mx-auto"
              >
                <Sparkles className="h-10 w-10" />
              </motion.div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Ready to Get Started?</h2>
              <p className="text-orange-100 max-w-xl mx-auto text-lg mb-10">Join thousands of satisfied customers across Tamil Nadu. Experience the convenience of quality services and products at your doorstep.</p>
              <div className="flex flex-wrap justify-center gap-4">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button asChild size="lg" className="rounded-full bg-white text-orange-600 hover:bg-orange-50 shadow-2xl h-14 px-10 text-lg font-semibold">
                    <Link href="/auth">
                      Create Free Account
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button asChild variant="outline" size="lg" className="rounded-full border-white/30 text-white hover:bg-white/10 h-14 px-10 text-lg">
                    <a href="#contact">Contact Us</a>
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Footer / Contact */}
        <section id="contact" className="pt-16 pb-8 px-6 bg-slate-900/30">
          <div className="mx-auto max-w-7xl">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 pb-16 border-b border-white/5">
              {/* Brand */}
              <div className="lg:col-span-2">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-1 shadow-lg shadow-orange-500/10">
                    <img src={doorstepLogo} alt="Logo" className="h-full w-full rounded-xl object-cover" />
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
                  <Button asChild size="sm" className="rounded-full bg-orange-500 hover:bg-orange-600">
                    <Link href="/auth">Get Started</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="rounded-full border-slate-700 hover:bg-slate-800">
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
                      <div>+91 95097 53683</div>
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

function SmartphoneIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6 text-white"
    >
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}
