import { getAuthClient } from "@/lib/auth-client";

export const DOCUMENTS_BUCKET = "docs-bucket-1";

function sanitizeFileName(fileName: string) {
  const sanitized = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || "document.pdf";
}

export function buildDocumentStoragePath(input: {
  userId: string;
  projectId: string;
  fileName: string;
}) {
  return `${input.userId}/projects/${input.projectId}/${crypto.randomUUID()}-${sanitizeFileName(
    input.fileName,
  )}`;
}

export async function uploadDocumentToStorage(input: {
  storagePath: string;
  file: File;
}) {
  const authClient = getAuthClient();
  const { error } = await authClient.storage
    .from(DOCUMENTS_BUCKET)
    .upload(input.storagePath, input.file, {
      cacheControl: "3600",
      contentType: input.file.type || "application/pdf",
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }
}

export async function downloadDocumentFromStorage(input: { storagePath: string }) {
  const authClient = getAuthClient();
  const { data, error } = await authClient.storage
    .from(DOCUMENTS_BUCKET)
    .download(input.storagePath);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function extractPdfPageCount(file: File) {
  const buffer = await file.arrayBuffer();
  const pdfText = new TextDecoder("latin1").decode(new Uint8Array(buffer));
  const pageMatches = pdfText.match(/\/Type\s*\/Page\b/g);

  return pageMatches?.length ? pageMatches.length : null;
}
