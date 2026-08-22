import { Request, Response, NextFunction } from "express";
import { AppError } from "@/utils/errors";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  let status = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "Something went wrong on our end. We are looking into it.";
  let details: any = undefined;

  if (err instanceof AppError) {
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
