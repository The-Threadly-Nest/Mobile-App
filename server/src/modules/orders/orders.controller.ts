import { Controller, HttpCode, Inject, UseGuards, Get, Post, Patch } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { ordersInputs, type OrdersInput } from "./orders.dto";

import { SessionGuard, RolesGuard, AllowedRoles } from "../../core/auth/access.guards";
import { EndpointRateGuard, RateLimit } from "../../core/http/endpoint-rate.guard";

@Controller("api/orders")
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly service: OrdersService) { }

  @Post("measurement-bookings")
  @UseGuards(SessionGuard, RolesGuard, EndpointRateGuard)
  @AllowedRoles("customer")
  @RateLimit("measurement-booking", 30, 3600000, true)
  postMeasurementBooking(@RequestInput(ordersInputs.postMeasurementBooking) input: OrdersInput<"postMeasurementBooking">) { return this.service.postMeasurementBooking(input); }

  @Get("my-orders")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  getMyOrders(@RequestInput(ordersInputs.getMyOrders) input: OrdersInput<"getMyOrders">) {
    return this.service.getMyOrders(input);
  }

  @Post("catalog-checkout")
  @UseGuards(SessionGuard, RolesGuard, EndpointRateGuard)
  @AllowedRoles("customer")
  @RateLimit("catalog-checkout", 30, 3600000, true)
  @HttpCode(200)
  postCatalogCheckout(@RequestInput(ordersInputs.postCatalogCheckout) input: OrdersInput<"postCatalogCheckout">) {
    return this.service.postCatalogCheckout(input);
  }

  @Post("my-orders")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  postMyOrders(@RequestInput(ordersInputs.postMyOrders) input: OrdersInput<"postMyOrders">) {
    return this.service.postMyOrders(input);
  }

  @Get("track/:id")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  getTrackById(@RequestInput(ordersInputs.getTrackById) input: OrdersInput<"getTrackById">) {
    return this.service.getTrackById(input);
  }

  @Post("track/:id/cancel")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  postTrackByIdCancel(@RequestInput(ordersInputs.postTrackByIdCancel) input: OrdersInput<"postTrackByIdCancel">) {
    return this.service.postTrackByIdCancel(input);
  }

  @Post("")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  post(@RequestInput(ordersInputs.post) input: OrdersInput<"post">) {
    return this.service.post(input);
  }

  @Get("")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  get(@RequestInput(ordersInputs.get) input: OrdersInput<"get">) {
    return this.service.get(input);
  }

  @Get(":id")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  getById(@RequestInput(ordersInputs.getById) input: OrdersInput<"getById">) {
    return this.service.getById(input);
  }

  @Patch(":id/assign")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin")
  @HttpCode(200)
  patchByIdAssign(@RequestInput(ordersInputs.patchByIdAssign) input: OrdersInput<"patchByIdAssign">) {
    return this.service.patchByIdAssign(input);
  }

  @Patch(":id/status")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  patchByIdStatus(@RequestInput(ordersInputs.patchByIdStatus) input: OrdersInput<"patchByIdStatus">) {
    return this.service.patchByIdStatus(input);
  }
}

