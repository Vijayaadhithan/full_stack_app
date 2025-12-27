import React from "react";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { productFilterConfig } from "@shared/config";
import { AlertCircle, ImagePlus, Loader2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { Product } from "@shared/schema";

type ProductFormDialogProps = {
  t: (key: string) => string;
  editingProduct: Product | null;
  form: UseFormReturn<any>;
  showAdvancedOptions: boolean;
  setShowAdvancedOptions: (value: boolean) => void;
  handleImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveImage: (index: number) => void;
  imageUploadError: string | null;
  specKey: string;
  specValue: string;
  setSpecKey: (value: string) => void;
  setSpecValue: (value: string) => void;
  tagInput: string;
  setTagInput: (value: string) => void;
  onSubmit: (data: any) => void;
  createPending: boolean;
  updatePending: boolean;
};

export default function ProductFormDialog({
  t,
  editingProduct,
  form,
  showAdvancedOptions,
  setShowAdvancedOptions,
  handleImageUpload,
  handleRemoveImage,
  imageUploadError,
  specKey,
  specValue,
  setSpecKey,
  setSpecValue,
  tagInput,
  setTagInput,
  onSubmit,
  createPending,
  updatePending,
}: ProductFormDialogProps) {
  const isSaving =
    form.formState.isSubmitting || createPending || updatePending;

  return (
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

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("category")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("select_category")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {productFilterConfig.categories.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.translationKey
                              ? t(category.translationKey)
                              : category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isAvailable"
                render={({ field }) => {
                  const isAvailable = field.value !== false;
                  return (
                    <FormItem className="flex h-full flex-col justify-between rounded-md border p-3">
                      <div className="space-y-1">
                        <FormLabel>{t("availability")}</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          {t("inventory_status_hint")}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            isAvailable
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isAvailable
                            ? t("inventory_have_it")
                            : t("inventory_finished")}
                        </span>
                        <FormControl>
                          <Switch
                            checked={isAvailable}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </div>
                    </FormItem>
                  );
                }}
              />
            </div>

            <div className="space-y-4">
              <FormLabel>{t("product_images")}</FormLabel>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {(form.watch("images") as string[] | undefined)?.map(
                  (image, index) => (
                    <div key={index} className="relative">
                      <img
                        src={image}
                        alt=""
                        className="w-full h-24 object-cover rounded"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1"
                        onClick={() => handleRemoveImage(index)}
                      >
                        <AlertCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ),
                )}
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

            <details className="rounded-md border bg-muted/30 p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {t("product_optional_details")}
              </summary>
              <div className="mt-3 space-y-4">
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
                <FormField
                  control={form.control}
                  name="mrp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("mrp")} (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const nextValue = e.target.valueAsNumber;
                            field.onChange(
                              Number.isNaN(nextValue) ? undefined : nextValue,
                            );
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </details>

            <div className="space-y-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="w-full justify-start px-0"
              >
                {showAdvancedOptions ? "Hide" : "Show"} Advanced Options
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
                          <Input {...field} type="number" min="0" step="0.01" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                              <Input {...field} type="number" min="0" step="0.01" />
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
                              <Input {...field} type="number" min="0" step="0.01" />
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
                              <Input {...field} type="number" min="0" step="0.01" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

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
                              (form.getValues("specifications") as Record<
                                string,
                                string
                              > | null) || {};
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
                        (form.watch("specifications") as Record<string, string>) ||
                          {},
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
                                (form.getValues("specifications") as Record<
                                  string,
                                  string
                                > | null) || {};
                              const nextSpecs = { ...currentSpecs };
                              delete nextSpecs[key];
                              form.setValue("specifications", nextSpecs);
                            }}
                          >
                            <AlertCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

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
                              (form.getValues("tags") as string[] | undefined) || [];
                            if (!currentTags.includes(tagInput)) {
                              form.setValue("tags", [...currentTags, tagInput]);
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
                              (form.getValues("tags") as string[] | undefined) || [];
                            if (!currentTags.includes(tagInput)) {
                              form.setValue("tags", [...currentTags, tagInput]);
                              setTagInput("");
                            }
                          }
                        }}
                      >
                        Add Tag
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(form.watch("tags") as string[] | undefined)?.map(
                        (tag, index) => (
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
                                  (form.getValues("tags") as string[] | undefined) || [];
                                form.setValue(
                                  "tags",
                                  currentTags.filter((_, i) => i !== index),
                                );
                              }}
                            >
                              <AlertCircle className="h-3 w-3" />
                            </Button>
                          </div>
                        ),
                      )}
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
              <Button type="submit" id="update_product" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingProduct ? t("update_product") : t("create_product")}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
}
