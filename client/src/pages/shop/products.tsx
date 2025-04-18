import { ShopLayout } from "@/components/layout/shop-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/language-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit2, ImagePlus, AlertCircle, Trash2 } from "lucide-react";
import { Product } from "@shared/schema";
import { z } from "zod";
import { useState } from "react";

const productFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.string().min(1, "Price is required"),
  mrp: z.string().min(1, "MRP is required"),
  stock: z.coerce.number().min(0, "Stock must be a positive number"),
  category: z.string().min(1, "Category is required"),
  images: z.array(z.string()).default([]),
  shopId: z.number().optional(),
  isAvailable: z.boolean().default(true),
});

type ProductFormData = z.infer<typeof productFormSchema>;

export default function ShopProducts() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: [`/api/products/shop/${user?.id}`],
    enabled: !!user?.id,
  });

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      mrp: "",
      stock: 0,
      category: "",
      isAvailable: true,
      images: [],
      shopId: user?.id || 0,
    },
  });

  const resetFormWithProduct = (product: Product) => {
    form.reset({
      name: product.name,
      description: product.description || "",
      price: String(product.price),
      mrp: String(product.mrp),
      stock: product.stock,
      category: product.category,
      images: product.images || [],
      isAvailable: product.isAvailable ?? true, // Default to true if null
      shopId: user?.id || 0,
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
    form.setValue("images", currentImages.filter((_, i) => i !== index));
  };

  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const res = await apiRequest("POST", "/api/products", {
        ...data,
        shopId: user?.id,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create product");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/products/shop/${user?.id}`] });
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
    mutationFn: async ({ id, data }: { id: number; data: Partial<ProductFormData> }) => {
      const formattedData = {
        name: data.name,
        description: data.description,
        price: data.price ? parseFloat(data.price) : undefined,
        mrp: data.mrp ? parseFloat(data.mrp) : undefined,
        stock: data.stock !== undefined ? Number(data.stock) : undefined,
        category: data.category,
        images: data.images,
        isAvailable: data.isAvailable,
      };

      console.log("Sending update request for product ID:", id, "with data:", formattedData);

      const res = await apiRequest("PATCH", `/api/products/${id}`, formattedData);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update product");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/products/shop/${user?.id}`] });
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
          console.log("Response cannot be parsed as JSON, returning default success message");
          return { message: "Product deleted successfully" };
        }
      } catch (error) {
        console.error("Delete product error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/products/shop/${user?.id}`] });
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
    if (editingProduct) {
      console.log("Updating product with ID:", editingProduct.id);
      updateProductMutation.mutate({ id: editingProduct.id, data });
    } else {
      createProductMutation.mutate(data);
    }
  };

  const resetForm = () => {
    form.reset({
      name: "",
      description: "",
      price: "",
      mrp: "",
      stock: 0,
      category: "",
      isAvailable: true,
      images: [],
      shopId: user?.id || 0,
    });
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
            <DialogContent className="sm:max-w-[800px]">
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
                              <Input {...field} type="number" min="0" step="0.01" />
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
                              <Input {...field} type="number" min="0" step="0.01" />
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
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={t("select_category")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Electronics">
                                  {t("electronics")}
                                </SelectItem>
                                <SelectItem value="Fashion">
                                  {t("fashion")}
                                </SelectItem>
                                <SelectItem value="Home">
                                  {t("home_living")}
                                </SelectItem>
                                <SelectItem value="Beauty">
                                  {t("beauty_personal_care")}
                                </SelectItem>
                                <SelectItem value="Books">
                                  {t("books_stationery")}
                                </SelectItem>
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
                        <p className="text-sm text-destructive">{imageUploadError}</p>
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
                        {editingProduct ? t("update_product") : t("create_product")}
                      </Button>
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
              <p className="text-muted-foreground">{t("no_products_created_yet")}</p>
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
                          product.stock <= (product.lowStockThreshold || 5) ? "text-red-500" : ""
                        }`}
                      >
                        {product.stock} {t("units")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>{t("category")}</span>
                      <span className="font-semibold">{product.category}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium">{t("availability")}</span>
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
