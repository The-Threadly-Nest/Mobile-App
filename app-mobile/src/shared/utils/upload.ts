import { useAuthStore } from "@/stores/useAuthStore";
import { apiFetch } from "@/shared/utils/apiClient";
import { File, UploadType } from "expo-file-system";

interface UploadResult {
  fileUrl: string;
  key: string;
}

/**
 * Uploads a local file from a device URI directly to Cloudflare R2 / S3
 * using a presigned URL fetched from the Express API.
 * 
 * @param fileUri The local device file URI (e.g. from expo-image-picker)
 * @param filename The original filename
 * @param contentType The MIME type (e.g. image/jpeg, application/pdf)
 */
export async function uploadFile(
  fileUri: string,
  filename: string,
  contentType: string
): Promise<UploadResult> {
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error("User must be authenticated to upload files.");
  }

  // Use Expo's native file API. Android recorder and picker URIs cannot be
  // reliably read with fetch(), even though the file exists on the device.
  const localFile = new File(fileUri);
  if (!localFile.exists) {
    throw new Error("Could not read the selected file.");
  }
  const fileSize = localFile.size;

  const maxBytes = contentType.startsWith("image/") ? 10 * 1024 * 1024 : 20 * 1024 * 1024;
  if (!fileSize || fileSize > maxBytes) {
    const maxMb = maxBytes / (1024 * 1024);
    throw new Error(`The selected file must be smaller than ${maxMb} MB.`);
  }

  // 1. Get presigned upload URL from Express API
  const presignData = await apiFetch<any>("/api/upload/presign", {
    method: "POST",
    body: JSON.stringify({ filename, contentType, fileSize }),
  });

  const { uploadUrl, fileUrl, key, requiresProcessing } = presignData;

  // Upload directly to S3 / R2 using the short-lived, size-bound URL.
  const uploadRes = await localFile.upload(uploadUrl, {
    httpMethod: "PUT",
    uploadType: UploadType.BINARY_CONTENT,
    mimeType: contentType,
    headers: {
      "Content-Type": contentType,
    },
  });

  if (uploadRes.status < 200 || uploadRes.status >= 300) {
    throw new Error(`Failed to upload file to storage bucket. Status: ${uploadRes.status}`);
  }

  if (requiresProcessing) {
    const completeData = await apiFetch<any>("/api/upload/complete-image", {
      method: "POST",
      body: JSON.stringify({ key }),
    });
    return { fileUrl: completeData.fileUrl, key: completeData.key };
  }

  return { fileUrl, key };
}
