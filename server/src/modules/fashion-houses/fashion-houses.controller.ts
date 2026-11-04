import { Controller, HttpCode, Inject, Get } from "@nestjs/common";
import { FashionHousesService } from "./fashion-houses.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { fashionHousesInputs, type FashionHousesInput } from "./fashion-houses.dto";

@Controller("api/fashion-houses")
export class FashionHousesController {
  constructor(@Inject(FashionHousesService) private readonly service: FashionHousesService) { }

  @Get("")
  @HttpCode(200)
  get(@RequestInput(fashionHousesInputs.get) input: FashionHousesInput<"get">) {
    return this.service.get(input);
  }

  @Get(":id")
  @HttpCode(200)
  getById(@RequestInput(fashionHousesInputs.getById) input: FashionHousesInput<"getById">) {
    return this.service.getById(input);
  }
}

