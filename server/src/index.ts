import { Logger } from "@nestjs/common";
import { createApplication } from "./app";

async function bootstrap(): Promise<void> {
  const app = await createApplication();
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? "4000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port.");
  await app.listen(port, "::");
  Logger.log(`Owuja API is ready and listening on port ${port}.`, "Bootstrap");
}

void bootstrap().catch((error: unknown) => {
  Logger.error(error instanceof Error ? error.message : "Application startup failed.", undefined, "Bootstrap");
  process.exitCode = 1;
});
