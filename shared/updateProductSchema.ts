import { z } from "zod";

// Define a schema for product updates with all fields optional
// This allows for partial updates including just toggling availability
export const updateProductSchema = z
  .object({
    name: z.string().min(1, "Name is required").optional(),
    description: z.string().optional(),
    price: z.coerce
      .number()
      .min(0, "Price must be a positive number")
      .optional(),
    mrp: z.coerce.number().min(0, "MRP must be a positive number").optional(),
    stock: z.coerce
      .number()
      .min(0, "Stock must be a positive number")
      .optional(),
    category: z.string().min(1, "Category is required").optional(),
    images: z.array(z.string()).optional(),
    isAvailable: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // Ensure at least one field is provided for the update
      return Object.keys(data).length > 0;
    },
    {
      message: "At least one field must be provided for update",
    },
  );

export type UpdateProduct = z.infer<typeof updateProductSchema>;
