import { Router } from "express";
import { randomUUID } from "crypto";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { presignUploadSchema } from "../schemas/upload.schema";
import { generatePresignedUploadUrl } from "../lib/s3";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(requireAuth);

router.post("/presign", validate({ body: presignUploadSchema }), async (req, res, next) => {
  try {
    const { filename, contentType } = req.body;
    
    // Determine the user's tenant (fashionHouseId)
    let fashionHouseId: string | null = null;
    const user = await prisma.user.findUnique({
      where: { id: req.authUserId },
      include: { fashionHouseOwned: true }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role === "admin" && user.fashionHouseOwned) {
      fashionHouseId = user.fashionHouseOwned.id;
    } else if (user.role === "staff" && user.fashionHouseId) {
      fashionHouseId = user.fashionHouseId;
    }

    // Safety: generate a unique file key prefixed by context to prevent path traversal
    // and isolate files by tenant (fashion house) or customer
    const fileUuid = randomUUID();
    let key = "";
    
    if (fashionHouseId) {
      key = `houses/${fashionHouseId}/${fileUuid}-${filename}`;
    } else if (user.role === "customer") {
      key = `customers/${user.id}/${fileUuid}-${filename}`;
    } else {
      key = `users/${user.id}/${fileUuid}-${filename}`;
    }

    const presignedData = await generatePresignedUploadUrl(key, contentType);
    
    res.json({
      uploadUrl: presignedData.uploadUrl,
      fileUrl: presignedData.fileUrl,
      key,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
