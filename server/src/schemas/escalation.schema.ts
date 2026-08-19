import { z } from "zod";

export const escalationIdParamSchema = z.object({ escalationId: z.string().uuid() });
export const resolveEscalationSchema = z.object({ assignToStaffId: z.string().uuid().optional() });
