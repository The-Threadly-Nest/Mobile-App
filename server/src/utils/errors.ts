import crypto from "crypto";

export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(status: number, code: string, message: string, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: any) {
    super(400, "BAD_REQUEST", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Your session has expired. Please log in again.") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to perform this action.") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource could not be found.") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "This action conflicts with existing data.", details?: any) {
    super(409, "CONFLICT", message, details);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = "Validation failed", details?: any) {
    super(422, "UNPROCESSABLE_ENTITY", message, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests. Please slow down.") {
    super(429, "TOO_MANY_REQUESTS", message);
  }
}
