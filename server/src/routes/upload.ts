import { Router } from "express";
import { randomUUID } from "crypto";
import path from "path";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { completeImageUploadSchema, presignUploadSchema } from "../schemas/upload.schema";
import { deleteStoredObject, generatePresignedUploadUrl, readStoredObject, storeProcessedImage } from "../lib/s3";
import { prisma } from "../lib/prisma";
import rateLimit from "express-rate-limit";
import sharp from "sharp";

const router = Router();
router.use(requireAuth);

const uploadSignatureLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

async function getUploadOwner(userId: string) {
  const user = await prisma.user.findUnique({
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

router.post("/presign", uploadSignatureLimiter, validate({ body: presignUploadSchema }), async (req, res, next) => {
  try {
    const { filename, contentType, fileSize } = req.body;
    
    // Determine the user's tenant (fashionHouseId)
    const { user, prefix } = await getUploadOwner(req.authUserId!);

    if (user.role === "customer" && contentType === "application/pdf") {
      return res.status(403).json({ error: "Customers can only upload images and audio." });
    }

    // Safety: generate a unique file key prefixed by context to prevent path traversal
    // and isolate files by tenant (fashion house) or customer
    const fileUuid = randomUUID();
    const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const requiresProcessing = contentType.startsWith("image/");
    const key = `${requiresProcessing ? "pending/" : ""}${prefix}/${fileUuid}-${safeName}`;

    const presignedData = await generatePresignedUploadUrl(key, contentType, fileSize);
    
    res.json({
      uploadUrl: presignedData.uploadUrl,
      fileUrl: presignedData.fileUrl,
      key,
      requiresProcessing,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/complete-image", uploadSignatureLimiter, validate({ body: completeImageUploadSchema }), async (req, res, next) => {
  const pendingKey = req.body.key as string;
  try {
    const { prefix } = await getUploadOwner(req.authUserId!);
    if (!pendingKey.startsWith(`pending/${prefix}/`)) {
      return res.status(403).json({ error: "You cannot process this upload." });
    }

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
      console.warn(JSON.stringify({ event: "pending_upload_cleanup_failed", key: pendingKey }));
    });

    return res.json({ fileUrl, key: finalKey, contentType: "image/webp", fileSize: converted.byteLength });
  } catch (err) {
    // A failed conversion must not leave an unverified public object behind.
    await deleteStoredObject(pendingKey).catch(() => undefined);
    next(err);
  }
});

export default router;
