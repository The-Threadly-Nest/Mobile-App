import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { DirectMessagesController } from "./direct-messages.controller";
import { DirectMessagesService } from "./direct-messages.service";
import { EscalationsController } from "./escalations.controller";
import { EscalationsService } from "./escalations.service";

@Module({ controllers: [ChatController, DirectMessagesController, EscalationsController], providers: [ChatService, DirectMessagesService, EscalationsService] })
export class MessagingModule { }

