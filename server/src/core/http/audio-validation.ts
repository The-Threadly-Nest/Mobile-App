import { BadRequestException, UnsupportedMediaTypeException } from "@nestjs/common";
import type { Request } from "express";
import type { UploadedFileData } from "./endpoint-input";

const audioTypes = new Set(["audio/m4a", "audio/x-m4a", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/aac", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm"]);

export function validateAudioFile(_request: Request, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void): void {
  if (!audioTypes.has(file.mimetype)) {
    callback(new UnsupportedMediaTypeException({ error: "Please choose a supported audio recording." }), false);
    return;
  }
  callback(null, true);
}

export function assertAudioContent(file: UploadedFileData): void {
  if (!audioTypes.has(file.mimetype)) throw new UnsupportedMediaTypeException({ error: "Please choose a supported audio recording." });
  const data = file.buffer;
  if (!data.length || data.length > 20 * 1024 * 1024) throw new BadRequestException({ error: "The recording is empty or too large. Please record it again." });
  const type = file.mimetype;
  const mp4 = data.length >= 12 && data.toString("ascii", 4, 8) === "ftyp";
  const wav = data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WAVE";
  const mp3 = data.length >= 3 && (data.toString("ascii", 0, 3) === "ID3" || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0));
  const aac = data.length >= 2 && data[0] === 0xff && (data[1] & 0xf6) === 0xf0;
  const ogg = data.length >= 4 && data.toString("ascii", 0, 4) === "OggS";
  const webm = data.length >= 4 && data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  const valid = type === "audio/ogg" ? ogg : type === "audio/webm" ? webm : type.includes("wav") ? wav
    : type === "audio/aac" ? aac : ["audio/mpeg", "audio/mp3"].includes(type) ? mp3 : mp4;
  if (!valid) throw new UnsupportedMediaTypeException({ error: "That file doesn't look like a valid audio recording. Please select or record it again." });
}
