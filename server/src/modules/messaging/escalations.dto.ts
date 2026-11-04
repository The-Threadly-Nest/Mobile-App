import { escalationIdParamSchema, resolveEscalationSchema } from "../../schemas/escalation.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";
import { assignEscalationSchema } from "../../schemas/endpoint-bodies.schema";

export const escalationsInputs = {
  get: {},
  getByEscalationId: { params: escalationIdParamSchema },
  patchByEscalationIdResolve: { params: escalationIdParamSchema, body: resolveEscalationSchema },
  patchByEscalationIdDecline: {},
  postAssign: { body: assignEscalationSchema },
} as const;

export type EscalationsInput<K extends keyof typeof escalationsInputs> = ValidatedInput<(typeof escalationsInputs)[K]>;
