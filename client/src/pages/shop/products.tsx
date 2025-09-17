import React from 'react';
import { ShopLayout } from "@/components/layout/shop-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/language-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Plus,
  Edit2,
  ImagePlus,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { Product } from "@shared/schema";
import { productFilterConfig } from "@shared/config";
import { z } from "zod";
import { useState } from "react";

const productFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().positive("Price must be a positive number"),
  mrp: z.coerce.number().positive("MRP must be a positive number"),
  stock: z.coerce.number().min(0, "Stock must be a positive number"),
  category: z.string().min(1, "Category is required"),
  images: z.array(z.string()).default([]),
  shopId: z.number().optional(),
  isAvailable: z.boolean().default(true),
  // New fields
  sku: z.string().optional(),
  barcode: z.string().optional(),
  weight: z.coerce.number().positive().optional(),
  dimensions: z
    .object({
      length: z.coerce.number().positive(),
      width: z.coerce.number().positive(),
      height: z.coerce.number().positive(),
    })
    .optional(),
  specifications: z.record(z.string(), z.string()).optional(),
  tags: z.array(z.string()).default([]),
  minOrderQuantity: z.coerce.number().positive().default(1),
  maxOrderQuantity: z.coerce.number().positive().optional(),
  lowStockThreshold: z.coerce.number().positive().optional(),
});

type ProductFormData = z.infer<typeof productFormSchema>;

export default function ShopProducts() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  const findCategory = (value: string) => {
    const lower = value.toLowerCase();
    return (
      productFilterConfig.categories.find(
        (category) => category.value === lower,
      ) ??
      productFilterConfig.categories.find(
        (category) => category.label.toLowerCase() === lower,
      )
    );
  };

  const normalizeCategoryValue = (value: string | null | undefined) => {
    if (!value) return "";
    const match = findCategory(value);
    return match?.value ?? value.toLowerCase();
  };

  const getCategoryLabel = (value: string | null | undefined) => {
    if (!value) return "";
    const match = findCategory(value);
    return match?.label ?? value;
  };

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: [`/api/products/shop/${user?.id}`],
    enabled: !!user?.id,
  });

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      mrp: 0,
      stock: 0,
      category: "",
      isAvailable: true,
      images: [],
      shopId: user?.id || 0,
      // New fields
      sku: "",
      barcode: "",
      weight: undefined,
      dimensions: undefined,
      specifications: {},
      tags: [],
      minOrderQuantity: 1,
      maxOrderQuantity: undefined,
      lowStockThreshold: undefined,
    },
  });

  // State for advanced options visibility
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  // State for specifications
  const [specKey, setSpecKey] = useState("");
  const [specValue, setSpecValue] = useState("");
  // State for tags input
  const [tagInput, setTagInput] = useState("");

  const resetFormWithProduct = (product: Product) => {
    form.reset({
      name: product.name,
      description: product.description || "",
      price: Number(product.price),
      mrp: Number(product.mrp),
      stock: product.stock,
      category: normalizeCategoryValue(product.category),
      images: product.images || [],
      isAvailable: product.isAvailable ?? true, // Default to true if null
      shopId: user?.id || 0,
      // New fields
      sku: product.sku || "",
      barcode: product.barcode || "",
      weight: product.weight ? Number(product.weight) : undefined,
      dimensions: product.dimensions || undefined,
      specifications: product.specifications || {},
      tags: product.tags || [],
      minOrderQuantity: product.minOrderQuantity || 1,
      maxOrderQuantity: product.maxOrderQuantity || undefined,
      lowStockThreshold: product.lowStockThreshold || undefined,
    });

    // Show advanced options if any are set
    if (
      product.sku ||
      product.barcode ||
      product.weight ||
      product.dimensions ||
      product.minOrderQuantity !== 1 ||
      product.maxOrderQuantity ||
      product.lowStockThreshold
    ) {
      setShowAdvancedOptions(true);
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files?.length) return;

    try {
      const formData = new FormData();
      formData.append("file", files[0]);

      const res = await apiRequest("POST", "/api/upload", formData);
      if (!res.ok) throw new Error("Failed to upload image");

      const { path } = await res.json();
      const currentImages = form.getValues("images") || [];
      form.setValue("images", [...currentImages, path]);
      setImageUploadError(null);
    } catch (error) {
      setImageUploadError("Failed to upload image. Please try again.");
    }
  };

  const handleRemoveImage = (index: number) => {
    const currentImages = form.getValues("images") || [];
    form.setValue(
      "images",
      currentImages.filter((_, i) => i !== index),
    );
  };

  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      // Format the data for API submission
      const formattedData = {
        ...data,
        shopId: user?.id,
        price: String(data.price),
        mrp: String(data.mrp),
        // Ensure dimensions are properly formatted
        dimensions: data.dimensions,
        // Convert weight to string if present
        weight: data.weight !== undefined ? String(data.weight) : undefined,
        specifications: data.specifications || {},
        tags: data.tags || [],
        minOrderQuantity: data.minOrderQuantity || 1,
        maxOrderQuantity: data.maxOrderQuantity,
        lowStockThreshold: data.lowStockThreshold,
      };

      const res = await apiRequest("POST", "/api/products", formattedData);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create product");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/products/shop/${user?.id}`],
      });
      toast({
        title: t("success"),
        description: t("product_created_successfully"),
      });
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<ProductFormData>;
    }) => {
      const formattedData = {
        name: data.name,
        description: data.description,
        price: String(data.price),
        mrp: String(data.mrp),
        stock: data.stock,
        category: data.category,
        images: data.images,
        isAvailable: data.isAvailable,
        // New fields
        sku: data.sku,
        barcode: data.barcode,
        // Convert weight to string if present
        weight: data.weight !== undefined ? String(data.weight) : undefined,
        // Ensure dimensions are properly formatted
        dimensions: data.dimensions,
        specifications: data.specifications,
        tags: data.tags,
        minOrderQuantity: data.minOrderQuantity,
        maxOrderQuantity: data.maxOrderQuantity,
        lowStockThreshold: data.lowStockThreshold,
      };

      console.log(
        "Sending update request for product ID:",
        id,
        "with data:",
        formattedData,
      );

      const res = await apiRequest(
        "PATCH",
        `/api/products/${id}`,
        formattedData,
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update product");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/products/shop/${user?.id}`],
      });
      toast({
        title: t("success"),
        description: t("product_updated_successfully"),
      });
      setDialogOpen(false);
      setEditingProduct(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      try {
        console.log(`Attempting to delete product with ID: ${productId}`);
        const res = await apiRequest("DELETE", `/api/products/${productId}`);
        console.log(`Delete product response status: ${res.status}`);

        try {
          const data = await res.json();
          console.log("Response data:", data);
          return data;
        } catch (parseError) {
          console.log(
            "Response cannot be parsed as JSON, returning default success message",
          );
          return { message: "Product deleted successfully" };
        }
      } catch (error) {
        console.error("Delete product error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/products/shop/${user?.id}`],
      });
      toast({
        title: t("success"),
        description: t("product_deleted_successfully"),
      });
    },
    onError: (error: Error) => {
      console.error("Delete product mutation error:", error);
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteProduct = (productId: number) => {
    deleteProductMutation.mutate(productId);
  };

  const onSubmit = (data: ProductFormData) => {
    const payload = {
      ...data,
      category: normalizeCategoryValue(data.category),
    };

    if (editingProduct) {
      console.log("Updating product with ID:", editingProduct.id);
      updateProductMutation.mutate({ id: editingProduct.id, data: payload });
    } else {
      createProductMutation.mutate(payload);
    }
  };

  const resetForm = () => {
    form.reset({
      name: "",
      description: "",
      price: 0,
      mrp: 0,
      stock: 0,
      category: "",
      isAvailable: true,
      images: [],
      shopId: user?.id || 0,
      // New fields
      sku: "",
      barcode: "",
      weight: undefined,
      dimensions: undefined,
      specifications: {},
      tags: [],
      minOrderQuantity: 1,
      maxOrderQuantity: undefined,
      lowStockThreshold: undefined,
    });
    setShowAdvancedOptions(false);
  };

  return (
    <ShopLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">{t("my_products")}</h1>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingProduct(null);
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t("add_product")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? t("edit_product") : t("add_product")}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  id="product-form"
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("product_name")}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("product_description")}</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("selling_price")} (₹)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                min="0"
                                step="0.01"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="mrp"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("mrp")} (₹)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                min="0"
                                step="0.01"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("category")}</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t("select_category")}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {productFilterConfig.categories.map(
                                  (category) => (
                                    <SelectItem
                                      key={category.value}
                                      value={category.value}
                                    >
                                      {category.translationKey
                                        ? t(category.translationKey)
                                        : category.label}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-4">
                      <FormLabel>{t("product_images")}</FormLabel>
                      <div className="grid grid-cols-4 gap-4">
                        {form.watch("images")?.map((image, index) => (
                          <div key={index} className="relative">
                            <img
                              src={image}
                              alt=""
                              className="w-full h-24 object-cover rounded"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 right-1"
                              onClick={() => handleRemoveImage(index)}
                            >
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <label className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer">
                          <ImagePlus className="h-8 w-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground mt-2">
                            {t("add_image")}
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={handleImageUpload}
                            accept="image/*"
                          />
                        </label>
                      </div>
                      {imageUploadError && (
                        <p className="text-sm text-destructive">
                          {imageUploadError}
                        </p>
                      )}
                    </div>

                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="stock"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("stock_quantity")}</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" min="0" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {/* Advanced Options Section */}
                      <div className="space-y-4">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setShowAdvancedOptions(!showAdvancedOptions)
                          }
                          className="w-full justify-start px-0"
                        >
                          {showAdvancedOptions ? "Hide" : "Show"} Advanced
                          Options
                        </Button>

                        {showAdvancedOptions && (
                          <div className="space-y-4">
                            <FormField
                              control={form.control}
                              name="sku"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>SKU</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="barcode"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Barcode</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="weight"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Weight (kg)</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* Dimensions Section */}
                            <div className="space-y-2">
                              <FormLabel>Dimensions (cm)</FormLabel>
                              <div className="grid gap-4 md:grid-cols-3">
                                <FormField
                                  control={form.control}
                                  name="dimensions.length"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Length</FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          type="number"
                                          min="0"
                                          step="0.01"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="dimensions.width"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Width</FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          type="number"
                                          min="0"
                                          step="0.01"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="dimensions.height"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Height</FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          type="number"
                                          min="0"
                                          step="0.01"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>

                            {/* Specifications Section */}
                            <div className="space-y-2">
                              <FormLabel>Specifications</FormLabel>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Key"
                                  value={specKey}
                                  onChange={(e) => setSpecKey(e.target.value)}
                                  className="flex-1"
                                />
                                <Input
                                  placeholder="Value"
                                  value={specValue}
                                  onChange={(e) => setSpecValue(e.target.value)}
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  onClick={() => {
                                    if (specKey && specValue) {
                                      const currentSpecs =
                                        form.getValues("specifications") || {};
                                      form.setValue("specifications", {
                                        ...currentSpecs,
                                        [specKey]: specValue,
                                      });
                                      setSpecKey("");
                                      setSpecValue("");
                                    }
                                  }}
                                >
                                  Add Spec
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {Object.entries(
                                  form.watch("specifications") || {},
                                ).map(([key, value]) => (
                                  <div
                                    key={key}
                                    className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full flex items-center gap-1"
                                  >
                                    <span>
                                      {key}: {value}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-4 w-4 rounded-full"
                                      onClick={() => {
                                        const currentSpecs =
                                          form.getValues("specifications") ||
                                          {};
                                        const newSpecs = { ...currentSpecs };
                                        delete newSpecs[key];
                                        form.setValue(
                                          "specifications",
                                          newSpecs,
                                        );
                                      }}
                                    >
                                      <AlertCircle className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Tags Section */}
                            <div className="space-y-2">
                              <FormLabel>Tags</FormLabel>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Add a tag"
                                  value={tagInput}
                                  onChange={(e) => setTagInput(e.target.value)}
                                  onKeyPress={(e) => {
                                    if (e.key === "Enter" && tagInput) {
                                      e.preventDefault();
                                      const currentTags =
                                        form.getValues("tags") || [];
                                      if (!currentTags.includes(tagInput)) {
                                        form.setValue("tags", [
                                          ...currentTags,
                                          tagInput,
                                        ]);
                                        setTagInput("");
                                      }
                                    }
                                  }}
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  onClick={() => {
                                    if (tagInput) {
                                      const currentTags =
                                        form.getValues("tags") || [];
                                      if (!currentTags.includes(tagInput)) {
                                        form.setValue("tags", [
                                          ...currentTags,
                                          tagInput,
                                        ]);
                                      }
                                    }
                                  }}
                                >
                                  Add Tag
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {form.watch("tags")?.map((tag, index) => (
                                  <div
                                    key={index}
                                    className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full flex items-center gap-1"
                                  >
                                    <span>{tag}</span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-4 w-4 rounded-full"
                                      onClick={() => {
                                        const currentTags =
                                          form.getValues("tags") || [];
                                        form.setValue(
                                          "tags",
                                          currentTags.filter(
                                            (_, i) => i !== index,
                                          ),
                                        );
                                      }}
                                    >
                                      <AlertCircle className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                              <FormField
                                control={form.control}
                                name="minOrderQuantity"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Min Order Quantity</FormLabel>
                                    <FormControl>
                                      <Input {...field} type="number" min="1" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="maxOrderQuantity"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Max Order Quantity</FormLabel>
                                    <FormControl>
                                      <Input {...field} type="number" min="1" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="lowStockThreshold"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Low Stock Threshold</FormLabel>
                                    <FormControl>
                                      <Input {...field} type="number" min="0" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end mt-4">
                        <Button
                          type="submit"
                          id="update_product"
                          disabled={
                            form.formState.isSubmitting ||
                            updateProductMutation.isPending ||
                            createProductMutation.isPending
                          }
                        >
                          {(form.formState.isSubmitting ||
                            updateProductMutation.isPending ||
                            createProductMutation.isPending) && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          {editingProduct
                            ? t("update_product")
                            : t("create_product")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !products?.length ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                {t("no_products_created_yet")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Card key={product.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{product.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {product.description}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingProduct(product);
                          resetFormWithProduct(product);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("delete_product_confirmation")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("delete_product_warning")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteProduct(product.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t("delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span>{t("price")}</span>
                      <div>
                        <span className="font-semibold">₹{product.price}</span>
                        {product.mrp > product.price && (
                          <span className="ml-2 line-through text-muted-foreground">
                            ₹{product.mrp}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>{t("stock")}</span>
                      <span
                        className={`font-semibold ${
                          product.stock <= (product.lowStockThreshold || 5)
                            ? "text-red-500"
                            : ""
                        }`}
                      >
                        {product.stock} {t("units")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>{t("category")}</span>
                      <span className="font-semibold">
                        {getCategoryLabel(product.category)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium">
                        {t("availability")}
                      </span>
                    </div>
                    <Switch
                      checked={product.isAvailable ?? false} // Handle null case
                      onCheckedChange={(checked) =>
                        updateProductMutation.mutate({
                          id: product.id,
                          data: { isAvailable: checked },
                        })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
