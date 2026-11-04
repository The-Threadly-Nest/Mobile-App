import { Global, Module } from "@nestjs/common";
import { PlatformAdminGuard, RolesGuard, SessionGuard } from "./access.guards";
import { EndpointRateGuard } from "../http/endpoint-rate.guard";

@Global()
@Module({ providers: [SessionGuard, RolesGuard, PlatformAdminGuard, EndpointRateGuard], exports: [SessionGuard, RolesGuard, PlatformAdminGuard, EndpointRateGuard] })
export class AccessModule {}
