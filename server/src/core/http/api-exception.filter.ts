import { ArgumentsHost, Catch, HttpException, type ExceptionFilter } from "@nestjs/common";
import type { Request, Response } from "express";
import { AppError } from "../../utils/errors";
import { appLogger, errorSummary } from "../logging";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    if (response.headersSent) return;

    let status = 500;
    let code = "INTERNAL_SERVER_ERROR";
    let message = "We couldn't complete your request. Please try again in a moment.";
    let details: unknown;
    let body: unknown;
    const error = exception && typeof exception === "object" ? exception : {};
    const databaseCode = "code" in error ? error.code : undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      code = status === 404 ? "NOT_FOUND" : "HTTP_ERROR";
      if (payload && typeof payload === "object") {
        body = payload;
      } else {
        message = String(payload);
      }
    } else if (exception instanceof AppError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (databaseCode === "P2002") {
      status = 400;
      code = "DUPLICATE_ENTRY";
      message = "A record with these details already exists. Please check your entries.";
    } else if (databaseCode === "P2003") {
      status = 400;
      code = "FOREIGN_KEY_ERROR";
      message = "We couldn't find the associated record. Please check your selection.";
    } else if (databaseCode === "P2025") {
      status = 404;
      code = "NOT_FOUND";
      message = "We couldn't find that record. It may have been updated or removed.";
    } else if (("name" in error && error.name === "ZodError") || "issues" in error) {
      status = 400;
      code = "INVALID_INPUT";
      message = "Please check your entries and fill in the required fields.";
    } else if ("type" in error && error.type === "entity.parse.failed") {
      status = 400;
      code = "INVALID_INPUT";
      message = "We couldn't read your request. Please check your entries and try again.";
    } else if ("status" in error && typeof error.status === "number" && Number.isInteger(error.status) && error.status >= 400 && error.status < 600) {
      status = error.status;
      if (status < 500 && exception instanceof Error) message = exception.message;
    }

    if (status >= 500) {
      body = undefined;
      details = undefined;
      message = "We couldn't complete your request. Please try again in a moment.";
    }

    if (status === 413) {
      body = { error: "That file is too large. Please choose a smaller file and try again." };
    }
    if (status === 400 && exception instanceof HttpException && exception.message === "Unexpected field") {
      body = { error: "We couldn't read that attachment. Please select the file again." };
    }

    const route = request.route?.path ?? "(unmatched route)";
    const description = `${request.method} ${route}`;
    if (status >= 500) {
      appLogger.error(`${description} failed (HTTP ${status}; ${code}). ${errorSummary(exception)}`);
      if (process.env.NODE_ENV !== "production" && exception instanceof Error) {
        const frames = exception.stack?.split("\n").filter((line) => /^\s+at /.test(line)).join("\n");
        if (frames) appLogger.debug(frames);
      }
    } else {
      appLogger.warn(`${description} was declined (HTTP ${status}; ${code}).`);
    }

    response.status(status).json(body ?? { success: false, error: { status, code, message, details } });
  }
}
