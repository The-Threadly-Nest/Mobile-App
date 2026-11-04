import { Controller, HttpCode, Inject, UseGuards, Get, Post, Patch, Delete } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { catalogInputs, type CatalogInput } from "./catalog.dto";

import { SessionGuard, RolesGuard, AllowedRoles } from "../../core/auth/access.guards";

@Controller("api/catalog")
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly service: CatalogService) { }

  @Get("")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  get(@RequestInput(catalogInputs.get) input: CatalogInput<"get">) {
    return this.service.get(input);
  }

  @Post("")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  post(@RequestInput(catalogInputs.post) input: CatalogInput<"post">) {
    return this.service.post(input);
  }

  @Patch(":id")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  patchById(@RequestInput(catalogInputs.patchById) input: CatalogInput<"patchById">) {
    return this.service.patchById(input);
  }

  @Delete(":id")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  deleteById(@RequestInput(catalogInputs.deleteById) input: CatalogInput<"deleteById">) {
    return this.service.deleteById(input);
  }

  @Get("marketplace")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  getMarketplace(@RequestInput(catalogInputs.getMarketplace) input: CatalogInput<"getMarketplace">) {
    return this.service.getMarketplace(input);
  }

  @Get("fashion-house/:fashionHouseId")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  getFashionHouseByFashionHouseId(@RequestInput(catalogInputs.getFashionHouseByFashionHouseId) input: CatalogInput<"getFashionHouseByFashionHouseId">) {
    return this.service.getFashionHouseByFashionHouseId(input);
  }

  @Get("item/:id")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  getItemById(@RequestInput(catalogInputs.getItemById) input: CatalogInput<"getItemById">) {
    return this.service.getItemById(input);
  }
}

