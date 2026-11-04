import { Module } from "@nestjs/common";
import { MoodboardController } from "./moodboard.controller";
import { MoodboardService } from "./moodboard.service";
import { SketchesController } from "./sketches.controller";
import { SketchesService } from "./sketches.service";

@Module({ controllers: [MoodboardController, SketchesController], providers: [MoodboardService, SketchesService] })
export class DesignModule { }

