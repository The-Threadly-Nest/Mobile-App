import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./core/http/api-exception.filter";
import { EndpointResultInterceptor } from "./core/http/endpoint-result";
import { swaggerSpec } from "./utils/swagger";
import { appLogger } from "./core/logging";
import { runDatabaseRequest } from "./core/database/database-context";
import { verifyDatabaseSecurity } from "./core/database/security-preflight";

let application: Promise<NestExpressApplication> | undefined;

async function bootstrapApplication(): Promise<NestExpressApplication> {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    throw new Error("DATABASE_URL and JWT_SECRET must be configured before starting Owuja.");
  }
  if (process.env.RATE_LIMIT_STORE && !["memory", "database"].includes(process.env.RATE_LIMIT_STORE)) {
    throw new Error("RATE_LIMIT_STORE must be memory or database.");
  }
  if (process.env.NODE_ENV === "production" && process.env.RATE_LIMIT_STORE === "memory") {
    throw new Error("Production requires shared database rate limits. Use RATE_LIMIT_STORE=database.");
  }
  if (process.env.NODE_ENV === "production" && process.env.JWT_SECRET.length < 32) {
    throw new Error("Production JWT_SECRET must contain at least 32 random characters.");
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, abortOnError: false });
  try {
    const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? "0");
    if (!Number.isInteger(proxyHops) || proxyHops < 0) throw new Error("TRUST_PROXY_HOPS must be a non-negative integer.");
    app.set("trust proxy", proxyHops);
    app.set("etag", false);
    app.disable("x-powered-by");
    app.use((_req: Request, _res: Response, next: NextFunction) => runDatabaseRequest(next));
    app.use((req: Request, res: Response, next: NextFunction) => {
      const startedAt = Date.now();
      res.on("finish", () => {
        const route = req.route?.path ?? "(unmatched route)";
        const outcome = res.statusCode >= 500 ? "failed" : res.statusCode >= 400 ? "was declined" : "completed";
        appLogger.log(`${req.method} ${route} ${outcome} — HTTP ${res.statusCode}, ${Date.now() - startedAt} ms.`);
      });
      next();
    });
    app.use(helmet());
    const origins = (process.env.ALLOWED_ORIGIN || "*").split(",").map((origin) => origin.trim()).filter(Boolean);
    app.enableCors({ origin: origins.includes("*") ? "*" : origins, exposedHeaders: ["X-Page", "X-Has-More", "X-Next-Page"] });
    app.use(express.json({ limit: "1mb" }));
    app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new EndpointResultInterceptor());
    await verifyDatabaseSecurity();
    await app.init();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}

export function createApplication(): Promise<NestExpressApplication> {
  if (!application) {
    application = bootstrapApplication().catch((error: unknown) => { application = undefined; throw error; });
  }
  return application;
}
