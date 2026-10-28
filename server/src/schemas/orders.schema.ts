import { z } from "zod";

export const createOrderSchema = z.object({
  customerId: z.string().uuid(),
  itemName: z.string().min(2).max(100),
  price: z.number().int().positive(), // Stored as integer cents/kobo
});

export const catalogCheckoutSchema = z.object({
  fashionHouseId: z.string().uuid(),
  items: z.array(z.object({
    catalogItemId: z.string().uuid(),
    quantity: z.number().int().min(1).max(20),
    selectedSize: z.string().max(50).optional().default(""),
    selectedColor: z.string().max(50).optional().default(""),
  })).min(1).max(50),
});

export const updateOrderStatusSchema = z.object({
  status: z.string().min(1),
});
