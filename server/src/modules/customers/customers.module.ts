import { Module } from "@nestjs/common";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";
import { MeasurementsController } from "./measurements.controller";
import { MeasurementsService } from "./measurements.service";
import { PreferencesController } from "./preferences.controller";
import { PreferencesService } from "./preferences.service";

@Module({ controllers: [CustomersController, MeasurementsController, PreferencesController], providers: [CustomersService, MeasurementsService, PreferencesService] })
export class CustomersModule { }

