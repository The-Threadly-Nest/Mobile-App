import { Module } from "@nestjs/common";
import { FashionHouseAdminController } from "./admin.controller";
import { FashionHouseAdminService } from "./admin.service";
import { FashionHousesController } from "./fashion-houses.controller";
import { FashionHousesService } from "./fashion-houses.service";

@Module({ controllers: [FashionHouseAdminController, FashionHousesController], providers: [FashionHouseAdminService, FashionHousesService] })
export class FashionHousesModule { }

