import { z } from "zod";

export const DocumentType = z.enum(["resume", "jd", "account_note", "other"]);
export type DocumentType = z.infer<typeof DocumentType>;

export const DocumentMeta = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: DocumentType,
  filename: z.string(),
  /** Short label the user gave it, e.g. "Google SWE JD". */
  label: z.string().max(200).optional(),
  chunkCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type DocumentMeta = z.infer<typeof DocumentMeta>;

export const UploadDocumentRequest = z.object({
  type: DocumentType,
  label: z.string().max(200).optional(),
});
export type UploadDocumentRequest = z.infer<typeof UploadDocumentRequest>;
