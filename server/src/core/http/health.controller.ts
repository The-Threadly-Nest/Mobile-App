import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get()
  root() { return { name: "Owuja API", status: "ok", health: "/health", docs: "/api-docs" }; }

  @Get("health")
  health() { return { status: "ok" }; }
}
