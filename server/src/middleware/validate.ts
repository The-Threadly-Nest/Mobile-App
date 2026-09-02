import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

interface ValidationSchemas { body?: ZodSchema; params?: ZodSchema; query?: ZodSchema }

export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) req.params = schemas.params.parse(req.params) as any;
      if (schemas.query) req.query = schemas.query.parse(req.query) as any;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.errors.map((e) => ({ path: e.path.join("."), message: e.message }));
        const detailedMsg = issues.map((i) => i.message).join(". ");
        return res.status(400).json({
          error: detailedMsg ? `Validation failed: ${detailedMsg}` : "Validation failed",
          issues,
        });
      }
      next(err);
    }
  };
}
