import { z } from "zod";

export const createOrderSchema = z.object({
  customerId: z.string().uuid(),
  itemName: z.string().min(2).max(100),
  price: z.number().int().positive(), // Stored as integer cents/kobo
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["order_placed", "in_production", "ready", "delivered"]),
});
