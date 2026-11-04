import { Controller, HttpCode, Inject, UseGuards, Get, Delete, Post, Patch } from "@nestjs/common";
import { DirectMessagesService } from "./direct-messages.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { directMessagesInputs, type DirectMessagesInput } from "./direct-messages.dto";

import { SessionGuard } from "../../core/auth/access.guards";

@Controller("api/direct-messages")
export class DirectMessagesController {
  constructor(@Inject(DirectMessagesService) private readonly service: DirectMessagesService) { }

  @Get("thread/:fashionHouseId")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  getThreadByFashionHouseId(@RequestInput(directMessagesInputs.getThreadByFashionHouseId) input: DirectMessagesInput<"getThreadByFashionHouseId">) {
    return this.service.getThreadByFashionHouseId(input);
  }

  @Delete("thread/:fashionHouseId")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  deleteThreadByFashionHouseId(@RequestInput(directMessagesInputs.deleteThreadByFashionHouseId) input: DirectMessagesInput<"deleteThreadByFashionHouseId">) {
    return this.service.deleteThreadByFashionHouseId(input);
  }

  @Delete("messages/:messageId")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  deleteMessagesByMessageId(@RequestInput(directMessagesInputs.deleteMessagesByMessageId) input: DirectMessagesInput<"deleteMessagesByMessageId">) {
    return this.service.deleteMessagesByMessageId(input);
  }

  @Delete("messages/:messageId/me")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  deleteMessagesByMessageIdMe(@RequestInput(directMessagesInputs.deleteMessagesByMessageIdMe) input: DirectMessagesInput<"deleteMessagesByMessageIdMe">) {
    return this.service.deleteMessagesByMessageIdMe(input);
  }

  @Post("thread/:fashionHouseId")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  postThreadByFashionHouseId(@RequestInput(directMessagesInputs.postThreadByFashionHouseId) input: DirectMessagesInput<"postThreadByFashionHouseId">) {
    return this.service.postThreadByFashionHouseId(input);
  }

  @Patch("thread/:fashionHouseId/read")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  patchThreadByFashionHouseIdRead(@RequestInput(directMessagesInputs.patchThreadByFashionHouseIdRead) input: DirectMessagesInput<"patchThreadByFashionHouseIdRead">) {
    return this.service.patchThreadByFashionHouseIdRead(input);
  }

  @Get("my-threads")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  getMyThreads(@RequestInput(directMessagesInputs.getMyThreads) input: DirectMessagesInput<"getMyThreads">) {
    return this.service.getMyThreads(input);
  }

  @Get("threads")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  getThreads(@RequestInput(directMessagesInputs.getThreads) input: DirectMessagesInput<"getThreads">) {
    return this.service.getThreads(input);
  }
}

