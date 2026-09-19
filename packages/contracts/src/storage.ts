import { z } from "zod";

export const StorageBucketSchema = z.enum(["portfolio", "verification"]);
export type StorageBucket = z.infer<typeof StorageBucketSchema>;

export const AllowedImageContentTypeSchema = z.enum([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
export type AllowedImageContentType = z.infer<
  typeof AllowedImageContentTypeSchema
>;

export const SignedUploadUrlRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  bucket: StorageBucketSchema,
  contentType: AllowedImageContentTypeSchema,
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024, "La taille du fichier ne peut excéder 5 Mo")
    .optional(),
});
export type SignedUploadUrlRequest = z.infer<
  typeof SignedUploadUrlRequestSchema
>;

export const SignedUploadUrlResponseSchema = z.object({
  fileId: z.string().uuid(),
  uploadUrl: z.string(),
  storagePath: z.string(),
  expiresInSeconds: z.number().int().positive(),
});
export type SignedUploadUrlResponse = z.infer<
  typeof SignedUploadUrlResponseSchema
>;

export const UploadFileResponseSchema = z.object({
  fileId: z.string().uuid(),
  storagePath: z.string(),
  publicUrl: z.string(),
  contentType: AllowedImageContentTypeSchema,
  sizeBytes: z.number().int().nonnegative(),
  exifStripped: z.boolean(),
});
export type UploadFileResponse = z.infer<typeof UploadFileResponseSchema>;
