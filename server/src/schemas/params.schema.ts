import { z } from "zod";

export const idParamSchema = z.object({
  id: z.string().uuid("A valid ID is required"),
});

export const fashionHouseIdParamSchema = z.object({
  fashionHouseId: z.string().uuid("A valid fashion house ID is required"),
});
