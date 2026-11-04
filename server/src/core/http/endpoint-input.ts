import { BadRequestException, createParamDecorator, ExecutionContext, Injectable, PipeTransform } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import type { AccountIdentity } from "../auth/account-identity";
import { validationMessage } from "./validation-messages";
import { defaultRouteParamsSchema } from "../../schemas/route-params.schema";

export interface UploadedFileData {
  buffer: Buffer;
  mimetype: string;
}

export interface EndpointContext<B = Record<string, never>, Q = Record<string, unknown>> extends AccountIdentity {
  body: B;
  query: Q;
  params: Record<string, string>;
  headers: Readonly<Record<string, string | string[] | undefined>>;
  file?: UploadedFileData;
}

export interface InputSchemas {
  body?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
}

export type ValidatedInput<S extends InputSchemas> = EndpointContext<
  S extends { body: infer B extends z.ZodTypeAny } ? z.output<B> : Record<string, never>,
  S extends { query: infer Q extends z.ZodTypeAny } ? z.output<Q> : Record<string, unknown>
>;

@Injectable()
export class EndpointInputPipe implements PipeTransform {
  constructor(private readonly schemas: InputSchemas) {}

  transform(input: EndpointContext<unknown, unknown>) {
    try {
      return {
        ...input,
        body: this.schemas.body ? this.schemas.body.parse(input.body) : {},
        params: (this.schemas.params ?? defaultRouteParamsSchema).parse(input.params),
        query: this.schemas.query ? this.schemas.query.parse(input.query) : {},
      };
    } catch (error) {
      if (!(error instanceof z.ZodError)) throw error;
      const issues = error.issues.map((issue) => ({ path: issue.path.join("."), message: validationMessage(issue) }));
      const messages = [...new Set(issues.map((issue) => issue.message))];
      throw new BadRequestException({ error: messages.slice(0, 3).join(" "), issues });
    }
  }
}

const requestInput = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<Request>();
  const params: Record<string, string> = {};
  for (const [name, value] of Object.entries(request.params)) {
    if (typeof value !== "string" || !value.length) throw new BadRequestException({ error: "We couldn't open that item. Please go back and select it again." });
    params[name] = value;
  }
  return {
    body: request.body ?? {}, query: request.query, params, headers: request.headers, file: request.file,
    authUserId: request.authUserId, authEmail: request.authEmail,
    authEmailVerified: request.authEmailVerified,
    authRole: request.authRole, authFashionHouseId: request.authFashionHouseId,
  };
});

export const RequestInput = (schemas: InputSchemas) => requestInput(undefined, new EndpointInputPipe(schemas));
