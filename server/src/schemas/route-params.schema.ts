import { z } from "zod";

const uuid = z.string().uuid();
const ids = new Set(["id", "customerId", "staffId", "orderId", "messageId", "bookingId", "escalationId", "fashionHouseId"]);
export const defaultRouteParamsSchema = z.record(z.string().max(50), z.string().trim().min(1).max(150)).superRefine((params, context) => {
  for (const [name, value] of Object.entries(params)) {
    if (ids.has(name) && !uuid.safeParse(value).success) context.addIssue({ code: "custom", path: [name], message: "Please select a valid item and try again." });
    if (name === "customerName" && (value.length > 100 || /[\u0000-\u001f]/.test(value))) context.addIssue({ code: "custom", path: [name], message: "Please enter a valid customer name." });
  }
});
export const chatTargetParamSchema = z.object({ fashionHouseId: z.union([uuid, z.literal("default")]) });
export const chatMessageParamSchema = z.object({ messageId: uuid });
