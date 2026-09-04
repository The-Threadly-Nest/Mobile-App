import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  let status = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "Oops! We ran into a quick hiccup on our end. Please try again in a moment.";
  let details: any = undefined;

  if (err.code === "P2002") {
    status = 400;
    code = "DUPLICATE_ENTRY";
    message = "An account with this email address already exists. Please log in or try a different email.";
  } else if (err.code === "P2003") {
    status = 400;
    code = "FOREIGN_KEY_ERROR";
    message = "We couldn't find the associated account or staff reference. Please double-check your selection.";
  } else if (err.code === "P2025") {
    status = 404;
    code = "NOT_FOUND";
    message = "We couldn't find that item or fashion house record. It may have been updated or moved.";
  } else if (err.name === "ZodError" || err.issues) {
    status = 400;
    code = "INVALID_INPUT";
    message = "Please check your entries and ensure all required fields are filled out correctly.";
  } else if (err instanceof AppError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.status) {
    status = err.status;
    message = err.message || message;
  }

  if (status === 500) {
    console.error(`[500 Server Error] [${req.method} ${req.path}] Unhandled error:`, err);
  } else {
    console.warn(`[${status} ${code}] [${req.method} ${req.path}] Details:`, details || err.message);
  }

  res.status(status).json({
    success: false,
    error: {
      status,
      code,
      message,
      details,
    },
  });
}
