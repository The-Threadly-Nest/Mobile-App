import { useAuthStore } from "@/stores/useAuthStore";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

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

  // 1. Get presigned upload URL from Express API
  const presignRes = await fetch(`${API_BASE_URL}/api/upload/presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ filename, contentType }),
  });

  const presignData = await presignRes.json();
  if (!presignRes.ok) {
    throw new Error(presignData.error ?? "Failed to request upload signature.");
  }

  const { uploadUrl, fileUrl, key } = presignData;

  // 2. Fetch the file content as a Blob on the device
  const localFile = await fetch(fileUri);
  const blob = await localFile.blob();

  // 3. Upload directly to S3 / R2 using PUT
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

  return { fileUrl, key };
}
