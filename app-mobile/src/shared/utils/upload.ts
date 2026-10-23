import { API_BASE_URL } from "@/api/config";
import { useAuthStore } from "@/stores/useAuthStore";

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

  // Read the local file before asking the server to authorize its exact size.
  const localFile = await fetch(fileUri);
  if (!localFile.ok) {
    throw new Error("Could not read the selected file.");
  }
  const blob = await localFile.blob();

  const maxBytes = contentType.startsWith("image/") ? 10 * 1024 * 1024 : 20 * 1024 * 1024;
  if (!blob.size || blob.size > maxBytes) {
    const maxMb = maxBytes / (1024 * 1024);
    throw new Error(`The selected file must be smaller than ${maxMb} MB.`);
  }

  // 1. Get presigned upload URL from Express API
  const presignRes = await fetch(`${API_BASE_URL}/api/upload/presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ filename, contentType, fileSize: blob.size }),
  });

  const presignData = await presignRes.json();
  if (!presignRes.ok) {
    throw new Error(presignData.error?.message ?? presignData.error ?? "Failed to request upload signature.");
  }

  const { uploadUrl, fileUrl, key, requiresProcessing } = presignData;

  // Upload directly to S3 / R2 using the short-lived, size-bound URL.
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    body: blob,
    headers: {
      "Content-Type": contentType,
    },
  });

  if (!uploadRes.ok) {
    throw new Error(`Failed to upload file to storage bucket. Status: ${uploadRes.status}`);
  }

  if (requiresProcessing) {
    const completeRes = await fetch(`${API_BASE_URL}/api/upload/complete-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ key }),
    });
    const completeData = await completeRes.json();
    if (!completeRes.ok) {
      throw new Error(completeData.error?.message ?? completeData.error ?? "Failed to process the uploaded image.");
    }
    return { fileUrl: completeData.fileUrl, key: completeData.key };
  }

  return { fileUrl, key };
}
