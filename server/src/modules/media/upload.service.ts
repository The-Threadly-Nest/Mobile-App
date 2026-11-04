import { Inject, Injectable } from "@nestjs/common";
import type { UploadInput } from "./upload.dto";
import { rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";
import { randomUUID } from "crypto";
import path from "path";

import { deleteStoredObject, generatePresignedUploadUrl, readStoredObject, storeProcessedImage } from "../../lib/s3";

import sharp from "sharp";

@Injectable()
export class UploadService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async postPresign(input: UploadInput<"postPresign">) {

    const { filename, contentType, fileSize } = input.body;

    // Determine the user's tenant (fashionHouseId)
    const { user, prefix } = await this.getUploadOwner(input.authUserId!);

    if (user.role === "customer" && contentType === "application/pdf") {
      return rejectRequest({ error: "Customers can only upload images and audio." }, 403);
    }

    // Safety: generate a unique file key prefixed by context to prevent path traversal
    // and isolate files by tenant (fashion house) or customer
    const fileUuid = randomUUID();
    const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const requiresProcessing = contentType.startsWith("image/");
    const key = `${requiresProcessing ? "pending/" : ""}${prefix}/${fileUuid}-${safeName}`;

    const presignedData = await generatePresignedUploadUrl(key, contentType, fileSize);

    return {
      uploadUrl: presignedData.uploadUrl,
      fileUrl: presignedData.fileUrl,
      key,
      requiresProcessing,
    };

  }

  async postCompleteImage(input: UploadInput<"postCompleteImage">) {
    const pendingKey = input.body.key as string;
    // Establish ownership before entering cleanup: rejected keys must never
    // reach deletion, even when a caller knows another tenant's object key.
    const { prefix } = await this.getUploadOwner(input.authUserId!);
    if (!pendingKey.startsWith(`pending/${prefix}/`)) {
      return rejectRequest({ error: "You cannot process this upload." }, 403);
    }
    try {

      const original = await readStoredObject(pendingKey, 10 * 1024 * 1024);
      const image = sharp(original, { animated: true, limitInputPixels: 20_000_000, failOn: "warning" });
      const metadata = await image.metadata();
      if (!metadata.format || !["jpeg", "png", "gif", "webp"].includes(metadata.format)) {
        throw Object.assign(new Error("The uploaded file is not a supported image."), { status: 415 });
      }
      const totalPixels = (metadata.width ?? 0) * (metadata.height ?? 0) * (metadata.pages ?? 1);
      if (!metadata.width || !metadata.height || totalPixels > 20_000_000) {
        throw Object.assign(new Error("The uploaded image dimensions are too large."), { status: 413 });
      }

      const converted = await image.rotate().webp({ lossless: true, effort: 6 }).toBuffer();
      if (converted.byteLength > 20 * 1024 * 1024) {
        throw Object.assign(new Error("The lossless WebP result exceeds 20 MB."), { status: 413 });
      }
      const finalKey = pendingKey
        .replace(/^pending\//, "")
        .replace(/\.[^.\/]+$/, "") + ".webp";
      const fileUrl = await storeProcessedImage(finalKey, converted);
      await deleteStoredObject(pendingKey).catch(() => {
        console.warn("The image was processed, but its temporary upload could not be removed. Storage cleanup needs attention.");
      });

      return { fileUrl, key: finalKey, contentType: "image/webp", fileSize: converted.byteLength };
    } catch (err) {
      // A failed conversion must not leave an unverified public object behind.
      await deleteStoredObject(pendingKey).catch(() => undefined);
      throw err;
    }
  }

  private async getUploadOwner(userId: string) {
    const user = await this.database.client.user.findUnique({
      where: { id: userId },
      include: { fashionHouseOwned: true },
    });
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    if (!['admin', 'staff', 'customer'].includes(user.role)) {
      throw Object.assign(new Error("This account cannot upload files."), { status: 403 });
    }
    const fashionHouseId = user.role === "admin"
      ? user.fashionHouseOwned?.id
      : user.role === "staff"
        ? user.fashionHouseId
        : null;
    if (user.role !== "customer" && !fashionHouseId) {
      throw Object.assign(new Error("A fashion house is required before uploading files."), { status: 403 });
    }
    const prefix = fashionHouseId ? `houses/${fashionHouseId}` : `customers/${user.id}`;
    return { user, prefix };
  }
}

