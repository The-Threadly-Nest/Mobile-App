import { Module } from "@nestjs/common";
import { DatabaseModule } from "./core/database/database.module";
import { AccessModule } from "./core/auth/access.module";
import { HealthController } from "./core/http/health.controller";
import { IdentityModule } from "./modules/identity/identity.module";
import { FashionHousesModule } from "./modules/fashion-houses/fashion-houses.module";
import { WorkforceModule } from "./modules/workforce/workforce.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { BillingModule } from "./modules/billing/billing.module";
import { AvailabilityModule } from "./modules/availability/availability.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { MessagingModule } from "./modules/messaging/messaging.module";
import { DesignModule } from "./modules/design/design.module";
import { MediaModule } from "./modules/media/media.module";
import { WaitlistModule } from "./modules/waitlist/waitlist.module";

@Module({ imports: [DatabaseModule, AccessModule, IdentityModule, FashionHousesModule, WorkforceModule, CatalogModule, OrdersModule, BillingModule, AvailabilityModule, CustomersModule, MessagingModule, DesignModule, MediaModule, WaitlistModule], controllers: [HealthController] })
export class AppModule {}

