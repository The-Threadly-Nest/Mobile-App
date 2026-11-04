import { Controller, HttpCode, Inject, UseGuards, Post, Get, Delete } from "@nestjs/common";
import { ChatService } from "./chat.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { chatInputs, type ChatInput } from "./chat.dto";
import { EndpointRateGuard, RateLimit } from "../../core/http/endpoint-rate.guard";
import { SessionGuard } from "../../core/auth/access.guards";

@Controller("api/chat")
export class ChatController {
  constructor(@Inject(ChatService) private readonly service: ChatService) { }

  @Post("session/:fashionHouseId/restart")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  postSessionByFashionHouseIdRestart(@RequestInput(chatInputs.postSessionByFashionHouseIdRestart) input: ChatInput<"postSessionByFashionHouseIdRestart">) {
    return this.service.postSessionByFashionHouseIdRestart(input);
  }

  @Get("session/:fashionHouseId")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  getSessionByFashionHouseId(@RequestInput(chatInputs.getSessionByFashionHouseId) input: ChatInput<"getSessionByFashionHouseId">) {
    return this.service.getSessionByFashionHouseId(input);
  }

  @Delete("messages/:messageId")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  deleteMessagesByMessageId(@RequestInput(chatInputs.deleteMessagesByMessageId) input: ChatInput<"deleteMessagesByMessageId">) {
    return this.service.deleteMessagesByMessageId(input);
  }

  @Delete("messages/:messageId/me")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  deleteMessagesByMessageIdMe(@RequestInput(chatInputs.deleteMessagesByMessageIdMe) input: ChatInput<"deleteMessagesByMessageIdMe">) {
    return this.service.deleteMessagesByMessageIdMe(input);
  }

  @Post("message")
  @UseGuards(SessionGuard, EndpointRateGuard)
  @HttpCode(200)

  @RateLimit("chat", 30, 600000, true)
  postMessage(@RequestInput(chatInputs.postMessage) input: ChatInput<"postMessage">) {
    return this.service.postMessage(input);
  }

  @Post("escalate")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  postEscalate(@RequestInput(chatInputs.postEscalate) input: ChatInput<"postEscalate">) {
    return this.service.postEscalate(input);
  }
}

