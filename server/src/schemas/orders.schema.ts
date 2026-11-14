import { z } from "zod";
export const measurementBookingSchema = z.object({ catalogItemId: z.string().uuid(), availableSlotId: z.string().uuid(), notes: z.string().trim().max(1000).optional() });

export const createOrderSchema = z.object({
  customerId: z.string().uuid(),
  itemName: z.string().min(2).max(100),
  price: z.number().int().positive().max(2147483647),
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
  comment: z.string().trim().min(3).max(500).optional(),
  status: z.enum([
    "order_placed", "pending_admin_review", "booked", "assigned",
    "measurements_confirmed", "fabric_sourced", "in_production", "quality_check",
    "ready", "ready_for_pickup", "completed", "delivered", "cancelled", "declined",
  ]),
});
