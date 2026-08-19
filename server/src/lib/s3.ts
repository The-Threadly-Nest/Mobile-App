import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3Client) {
    if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
      throw Object.assign(new Error("Storage service is not configured on the server"), { status: 500 });
    }
    s3Client = new S3Client({
      endpoint: R2_ENDPOINT,
      region: "auto",
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

interface PresignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
}

export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 300
): Promise<PresignedUrlResponse> {
  const client = getS3Client();
  const bucket = R2_BUCKET_NAME!;
  
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  
  // Public URL is either a custom public domain/URL or built using endpoint/bucket
  const baseUrl = R2_PUBLIC_URL ? R2_PUBLIC_URL.replace(/\/$/, "") : `${R2_ENDPOINT}/${bucket}`;
  const fileUrl = `${baseUrl}/${key}`;

  return { uploadUrl, fileUrl };
}
