import { Controller, HttpCode, Inject, Get, UseGuards } from "@nestjs/common";
import { SessionGuard } from "../../core/auth/access.guards";
import { FashionHousesService } from "./fashion-houses.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { fashionHousesInputs, type FashionHousesInput } from "./fashion-houses.dto";

@Controller("api/fashion-houses")
export class FashionHousesController {
  constructor(@Inject(FashionHousesService) private readonly service: FashionHousesService) { }

  @Get("")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  get(@RequestInput(fashionHousesInputs.get) input: FashionHousesInput<"get">) {
    return this.service.get(input);
  }

  @Get(":id")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  getById(@RequestInput(fashionHousesInputs.getById) input: FashionHousesInput<"getById">) {
    return this.service.getById(input);
  }
}

