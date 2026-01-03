import React from 'react';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';
import {
    type CategoryImage,
    type ShopBanner,
    getGradientCSS,
} from '@shared/predefinedImages';

interface CategoryIconProps {
    /** Category image data */
    category: CategoryImage;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg' | 'xl';
    /** Whether this is selected/active */
    selected?: boolean;
    /** Click handler */
    onClick?: () => void;
    /** Show label */
    showLabel?: boolean;
    /** Show Tamil label */
    showTamilLabel?: boolean;
    /** Additional className */
    className?: string;
}

const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
    xl: 'w-28 h-28',
};

const iconSizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-10 h-10',
    xl: 'w-14 h-14',
};

const labelSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
};

/**
 * CategoryIcon - A beautiful, performant icon component for categories
 * 
 * Features:
 * - Zero network requests (uses inline Lucide icons)
 * - Smooth gradient backgrounds
 * - Hover animations
 * - Selection state
 * - Responsive sizing
 */
export function CategoryIcon({
    category,
    size = 'md',
    selected = false,
    onClick,
    showLabel = false,
    showTamilLabel = false,
    className,
}: CategoryIconProps) {
    // Get the icon component from Lucide
    const IconComponent = (LucideIcons as any)[category.icon] || LucideIcons.Package;

    return (
        <div
            className={cn(
                'flex flex-col items-center gap-1 cursor-pointer transition-all duration-200',
                onClick && 'hover:scale-105',
                className
            )}
            onClick={onClick}
        >
            <div
                className={cn(
                    'rounded-xl flex items-center justify-center transition-all duration-300',
                    sizeClasses[size],
                    selected && 'ring-2 ring-offset-2 ring-primary shadow-lg',
                    onClick && 'hover:shadow-md',
                )}
                style={{
                    background: getGradientCSS(category.gradient),
                }}
            >
                <IconComponent
                    className={cn(
                        iconSizeClasses[size],
                        'text-white drop-shadow-sm transition-transform duration-200',
                        onClick && 'group-hover:scale-110'
                    )}
                    strokeWidth={2}
                />
            </div>
            {showLabel && (
                <span
                    className={cn(
                        'font-medium text-center line-clamp-2 max-w-[80px]',
                        labelSizeClasses[size],
                        selected ? 'text-primary' : 'text-muted-foreground'
                    )}
                >
                    {category.label}
                </span>
            )}
            {showTamilLabel && (
                <span
                    className={cn(
                        'text-center text-muted-foreground line-clamp-1 max-w-[80px]',
                        size === 'xl' ? 'text-sm' : 'text-xs',
                    )}
                >
                    {category.labelTamil}
                </span>
            )}
        </div>
    );
}

interface CategoryIconGridProps {
    /** List of categories to display */
    categories: CategoryImage[];
    /** Currently selected category ID */
    selectedId?: string;
    /** Callback when a category is selected */
    onSelect?: (category: CategoryImage) => void;
    /** Size of icons */
    size?: 'sm' | 'md' | 'lg';
    /** Show labels */
    showLabels?: boolean;
    /** Columns on mobile */
    mobileColumns?: 3 | 4 | 5;
    /** Additional className */
    className?: string;
}

/**
 * CategoryIconGrid - A responsive grid of category icons
 */
export function CategoryIconGrid({
    categories,
    selectedId,
    onSelect,
    size = 'md',
    showLabels = true,
    mobileColumns = 4,
    className,
}: CategoryIconGridProps) {
    const gridClasses = {
        3: 'grid-cols-3',
        4: 'grid-cols-4',
        5: 'grid-cols-5',
    };

    return (
        <div
            className={cn(
                'grid gap-3 sm:gap-4',
                gridClasses[mobileColumns],
                'sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8',
                className
            )}
        >
            {categories.map((category) => (
                <CategoryIcon
                    key={category.id}
                    category={category}
                    size={size}
                    selected={selectedId === category.id}
                    onClick={onSelect ? () => onSelect(category) : undefined}
                    showLabel={showLabels}
                />
            ))}
        </div>
    );
}

interface ShopBannerPreviewProps {
    /** Shop banner data */
    banner: ShopBanner;
    /** Width/height of preview */
    size?: 'sm' | 'md' | 'lg';
    /** Selected state */
    selected?: boolean;
    /** Click handler */
    onClick?: () => void;
    /** Show label */
    showLabel?: boolean;
    /** Additional className */
    className?: string;
}

const bannerSizeClasses = {
    sm: 'w-24 h-12',
    md: 'w-32 h-16',
    lg: 'w-48 h-24',
};

/**
 * ShopBannerPreview - Preview component for shop banners
 */
export function ShopBannerPreview({
    banner,
    size = 'md',
    selected = false,
    onClick,
    showLabel = true,
    className,
}: ShopBannerPreviewProps) {
    const IconComponent = (LucideIcons as any)[banner.icon] || LucideIcons.Store;

    // Generate pattern overlay
    const getPatternStyle = (pattern: ShopBanner['pattern']): React.CSSProperties => {
        switch (pattern) {
            case 'diagonal':
                return {
                    backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(255,255,255,0.1) 10px,
            rgba(255,255,255,0.1) 20px
          )`,
                };
            case 'dots':
                return {
                    backgroundImage: `radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)`,
                    backgroundSize: '10px 10px',
                };
            case 'waves':
                return {
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='12' viewBox='0 0 20 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 12c0-2 1-4 3-4s3 2 5 2 3-2 5-2 3 2 3 4' fill='none' stroke='rgba(255,255,255,0.1)' stroke-width='1'/%3E%3C/svg%3E")`,
                };
            case 'circles':
                return {
                    backgroundImage: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)`,
                    backgroundSize: '30px 30px',
                };
            default:
                return {};
        }
    };

    return (
        <div
            className={cn(
                'flex flex-col items-center gap-1.5 cursor-pointer transition-all duration-200',
                onClick && 'hover:scale-105',
                className
            )}
            onClick={onClick}
        >
            <div
                className={cn(
                    'rounded-lg overflow-hidden flex items-center justify-center relative transition-all duration-300',
                    bannerSizeClasses[size],
                    selected && 'ring-2 ring-offset-2 ring-primary shadow-lg',
                    onClick && 'hover:shadow-md',
                )}
                style={{
                    background: getGradientCSS(banner.bannerGradient, '120deg'),
                }}
            >
                {/* Pattern overlay */}
                <div
                    className="absolute inset-0"
                    style={getPatternStyle(banner.pattern)}
                />
                {/* Icon */}
                <IconComponent
                    className="w-8 h-8 text-white drop-shadow-sm relative z-10"
                    strokeWidth={1.5}
                />
            </div>
            {showLabel && (
                <span
                    className={cn(
                        'text-xs font-medium text-center line-clamp-1',
                        selected ? 'text-primary' : 'text-muted-foreground'
                    )}
                >
                    {banner.label}
                </span>
            )}
        </div>
    );
}

/**
 * ProductCategoryBadge - Small inline badge showing product category
 */
export function ProductCategoryBadge({
    category,
    className,
}: {
    category: CategoryImage;
    className?: string;
}) {
    const IconComponent = (LucideIcons as any)[category.icon] || LucideIcons.Package;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white',
                className
            )}
            style={{
                background: getGradientCSS(category.gradient),
            }}
        >
            <IconComponent className="w-3 h-3" strokeWidth={2} />
            {category.label}
        </span>
    );
}
