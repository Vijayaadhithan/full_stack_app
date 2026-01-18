import React, { Suspense } from "react";
import {
    Wrench,
    ShoppingBag,
    Star,
} from "lucide-react";

// Lightweight placeholder while hero cards load
function HeroCardPlaceholder() {
    return (
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/5 animate-pulse">
            <div className="h-12 w-12 rounded-xl bg-slate-800 mb-4" />
            <div className="h-5 w-24 bg-slate-800 rounded mb-2" />
            <div className="h-4 w-32 bg-slate-800/60 rounded" />
        </div>
    );
}

// Hero card component - only loaded on desktop
function HeroCard({
    children,
    className = ""
}: {
    children: React.ReactNode;
    className?: string
}) {
    return (
        <div className={`transform transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.01] ${className}`}>
            {children}
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

// The actual hero visuals - will be code-split
export function HeroVisuals() {
    return (
        <div className="relative hidden lg:block">
            <div className="relative z-10 grid grid-cols-2 gap-5">
                <div className="space-y-5 pt-12 animate-float">
                    <HeroCard>
                        <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 backdrop-blur-xl shadow-2xl shadow-blue-500/10">
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mb-4">
                                <Wrench className="h-6 w-6 text-white" />
                            </div>
                            <h3 className="font-bold text-white text-lg">Expert Services</h3>
                            <p className="text-sm text-slate-400 mt-2">Plumbers, Electricians, Carpenters & more ready to help.</p>
                        </div>
                    </HeroCard>
                    <HeroCard>
                        <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 backdrop-blur-xl shadow-2xl shadow-purple-500/10">
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-400 flex items-center justify-center mb-4">
                                <ShoppingBag className="h-6 w-6 text-white" />
                            </div>
                            <h3 className="font-bold text-white text-lg">Local Shops</h3>
                            <p className="text-sm text-slate-400 mt-2">Groceries, Fashion & Electronics from nearby stores.</p>
                        </div>
                    </HeroCard>
                </div>
                <div className="space-y-5 animate-float-delayed">
                    <HeroCard>
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 border border-orange-400/30 shadow-2xl shadow-orange-500/20 text-white">
                            <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
                                <Star className="h-6 w-6 text-white fill-white" />
                            </div>
                            <h3 className="font-bold text-xl">Top Rated</h3>
                            <p className="text-sm text-orange-100 mt-2">Quality you can trust, reviewed by your community.</p>
                        </div>
                    </HeroCard>
                    <HeroCard>
                        <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 backdrop-blur-xl shadow-2xl shadow-emerald-500/10">
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 flex items-center justify-center mb-4">
                                <SmartphoneIcon />
                            </div>
                            <h3 className="font-bold text-white text-lg">Digital Access</h3>
                            <p className="text-sm text-slate-400 mt-2">Easy booking via phone or web. Simple & accessible.</p>
                        </div>
                    </HeroCard>
                </div>
            </div>

            {/* Decorative Background */}
            <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/20 via-purple-500/10 to-blue-500/20 rounded-full blur-[100px] -z-10" />
        </div>
    );
}

// Suspense wrapper for lazy loading
export function LazyHeroVisuals({ show }: { show: boolean }) {
    if (!show) return null;

    return (
        <Suspense fallback={
            <div className="relative hidden lg:block">
                <div className="relative z-10 grid grid-cols-2 gap-5">
                    <div className="space-y-5 pt-12">
                        <HeroCardPlaceholder />
                        <HeroCardPlaceholder />
                    </div>
                    <div className="space-y-5">
                        <HeroCardPlaceholder />
                        <HeroCardPlaceholder />
                    </div>
                </div>
            </div>
        }>
            <HeroVisuals />
        </Suspense>
    );
}

export default HeroVisuals;
