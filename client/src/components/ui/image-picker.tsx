import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CategoryIcon, CategoryIconGrid } from './category-icon';
import {
    type CategoryImage,
    productCategoryImages,
    serviceCategoryImages,
    getProductCategoriesArray,
    getServiceCategoriesArray,
} from '@shared/predefinedImages';
import { Search } from 'lucide-react';

interface ImagePickerProps {
    /** Type of images to show */
    type: 'product' | 'service';
    /** Currently selected category ID */
    selectedId?: string;
    /** Callback when an image is selected */
    onSelect: (category: CategoryImage) => void;
    /** Show search filter */
    showSearch?: boolean;
    /** Max height for scrollable area */
    maxHeight?: string;
    /** Additional className */
    className?: string;
}

/**
 * ImagePicker - Select from predefined category images
 * 
 * Features:
 * - Grid of beautiful gradient icons
 * - Search/filter functionality
 * - Keyboard navigation ready
 * - Responsive layout
 */
export function ImagePicker({
    type,
    selectedId,
    onSelect,
    showSearch = true,
    maxHeight = '300px',
    className,
}: ImagePickerProps) {
    const [searchQuery, setSearchQuery] = useState('');

    // Get categories based on type
    const allCategories = useMemo(() => {
        return type === 'product'
            ? getProductCategoriesArray()
            : getServiceCategoriesArray();
    }, [type]);

    // Filter categories based on search
    const filteredCategories = useMemo(() => {
        if (!searchQuery.trim()) return allCategories;

        const query = searchQuery.toLowerCase();
        return allCategories.filter(
            (cat) =>
                cat.label.toLowerCase().includes(query) ||
                cat.labelTamil.includes(query) ||
                cat.id.includes(query)
        );
    }, [allCategories, searchQuery]);

    return (
        <div className={cn('space-y-3', className)}>
            {showSearch && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search categories..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
            )}

            <ScrollArea style={{ maxHeight }} className="pr-2">
                {filteredCategories.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No categories found
                    </div>
                ) : (
                    <CategoryIconGrid
                        categories={filteredCategories}
                        selectedId={selectedId}
                        onSelect={onSelect}
                        size="md"
                        showLabels
                        mobileColumns={4}
                    />
                )}
            </ScrollArea>
        </div>
    );
}

interface CategorySelectProps {
    /** Type of category */
    type: 'product' | 'service';
    /** Currently selected category ID */
    value?: string;
    /** Callback when category changes */
    onChange: (categoryId: string) => void;
    /** Label for the field */
    label?: string;
    /** Error message */
    error?: string;
    /** Whether the field is disabled */
    disabled?: boolean;
    /** Additional className */
    className?: string;
}

/**
 * CategorySelect - A compact category selector with preview
 * 
 * Shows selected category with icon, and expands to full picker on click
 */
export function CategorySelect({
    type,
    value,
    onChange,
    label,
    error,
    disabled,
    className,
}: CategorySelectProps) {
    const [isOpen, setIsOpen] = useState(false);

    const categories = type === 'product' ? productCategoryImages : serviceCategoryImages;
    const selectedCategory = value ? categories[value] : null;

    const handleSelect = (category: CategoryImage) => {
        onChange(category.id);
        setIsOpen(false);
    };

    return (
        <div className={cn('space-y-2', className)}>
            {label && (
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {label}
                </label>
            )}

            <div
                className={cn(
                    'relative border rounded-lg p-3 cursor-pointer transition-colors',
                    disabled && 'opacity-50 cursor-not-allowed',
                    error ? 'border-destructive' : 'border-input hover:border-primary/50',
                    isOpen && 'ring-2 ring-primary ring-offset-2'
                )}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                {selectedCategory ? (
                    <div className="flex items-center gap-3">
                        <CategoryIcon category={selectedCategory} size="sm" />
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{selectedCategory.label}</p>
                            <p className="text-sm text-muted-foreground truncate">
                                {selectedCategory.labelTamil}
                            </p>
                        </div>
                        <span className="text-muted-foreground text-sm">Change</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground py-2">
                        <span>Select a category</span>
                    </div>
                )}
            </div>

            {isOpen && !disabled && (
                <div className="border rounded-lg p-3 bg-background shadow-lg">
                    <ImagePicker
                        type={type}
                        selectedId={value}
                        onSelect={handleSelect}
                        maxHeight="250px"
                    />
                </div>
            )}

            {error && (
                <p className="text-sm text-destructive">{error}</p>
            )}
        </div>
    );
}

/**
 * Get the image data for a product category by ID
 */
export function getProductCategoryImage(categoryId: string): CategoryImage | null {
    return productCategoryImages[categoryId] || null;
}

/**
 * Get the image data for a service category by ID
 */
export function getServiceCategoryImage(categoryId: string): CategoryImage | null {
    return serviceCategoryImages[categoryId] || null;
}
