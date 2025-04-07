import { z } from "zod";

// Define a simplified schema for product updates with only the required fields
export const updateProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be a positive number"),
  mrp: z.coerce.number().min(0, "MRP must be a positive number"),
  stock: z.coerce.number().min(0, "Stock must be a positive number"),
  category: z.string().min(1, "Category is required"),
  images: z.array(z.string()).default([]),
  isAvailable: z.boolean().default(true),
});

export type UpdateProduct = z.infer<typeof updateProductSchema>;