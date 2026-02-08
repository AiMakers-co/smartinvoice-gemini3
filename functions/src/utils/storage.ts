/**
 * Storage Utilities
 * Helpers for Cloud Storage operations
 */
import { storage } from "../config/firebase";

const BUCKET_NAME = "ormandy-7ed6c.firebasestorage.app";

/**
 * Download a file from Cloud Storage and return as base64
 */
export async function downloadFileAsBase64(fileUrl: string): Promise<string> {
  const bucket = storage.bucket(BUCKET_NAME);
  
  // Parse Firebase Storage URL format:
  // https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?alt=media&token=...
  let filePath: string;
  
  if (fileUrl.includes('firebasestorage.googleapis.com')) {
    // Extract path from Firebase Storage URL
    const match = fileUrl.match(/\/o\/(.+?)(?:\?|$)/);
    if (!match) {
      throw new Error(`Invalid Firebase Storage URL: ${fileUrl}`);
    }
    filePath = decodeURIComponent(match[1]);
  } else if (fileUrl.includes('storage.googleapis.com')) {
    // Handle GCS URL format: https://storage.googleapis.com/BUCKET/PATH
    filePath = fileUrl.replace(`https://storage.googleapis.com/${BUCKET_NAME}/`, "");
    filePath = decodeURIComponent(filePath);
  } else {
    // Assume it's already a path
    filePath = fileUrl;
  }
  
  const file = bucket.file(filePath);
  const [fileBuffer] = await file.download();
  return fileBuffer.toString("base64");
}

/**
 * Get the bucket name
 */
export function getBucketName(): string {
  return BUCKET_NAME;
}

