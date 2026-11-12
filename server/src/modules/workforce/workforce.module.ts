import { Module } from "@nestjs/common";
import { StaffController } from "./staff.controller";
import { StaffService } from "./staff.service";
import { PlatformUsersController } from "./platform-users.controller";
import { MediaCleanupService } from "./media-cleanup.service";

@Module({ controllers: [StaffController, PlatformUsersController], providers: [StaffService, MediaCleanupService] })
export class WorkforceModule { }

