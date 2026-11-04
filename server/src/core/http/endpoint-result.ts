import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from "@nestjs/common";
import type { Response } from "express";
import { map } from "rxjs/operators";

/** A returned value with response metadata, handled only at the HTTP boundary. */
export class EndpointResult<T> {
  constructor(readonly data: T, readonly status = 200, readonly headers: Readonly<Record<string, string>> = {}) {}
}

export function result<T>(data: T, status = 200): EndpointResult<T> {
  return new EndpointResult(data, status);
}

export function rejectRequest(body: Record<string, unknown>, status: number): never {
  throw new HttpException(body, status);
}

@Injectable()
export class EndpointResultInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map((value: unknown) => {
      if (!(value instanceof EndpointResult)) return value;
      const response = context.switchToHttp().getResponse<Response>();
      response.status(value.status);
      for (const [name, header] of Object.entries(value.headers)) response.setHeader(name, header);
      return value.data;
    }));
  }
}
