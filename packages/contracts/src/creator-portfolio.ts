// Contract of the portfolio of a creator (docs/mvp/07 RG77 to RG85; 17 §5.2 block 6; jalons/l2g/
// modele.md §2, §6; EC-L2G-3, EC-L2G-4, EC-L2G-10). Shared by apps/api and apps/web. The account is
// always the session's; the only identifiers on a path are the creator's own visuals (T14: another
// account's visual answers as an unknown one). No visual leaves the API as an address: the bytes of
// a visual travel as JSON in base64, like the logo and the pieces of evidence (D82 (5)), and a key of
// Storage, a checksum, an agent or an internal comment are in no answer (T9.2, T1.5).
// The bounds are the ones of `@influx/domain/creator-profile` (a test holds them equal) and of the
// base (0242, 0243).
import { z } from "./zod.ts";
import {
  creatorProfileCompletenessSchema,
  creatorProfileStatusSchema,
} from "./creator-profile.ts";

/** 3 to 8 visuals (RG77). Twin of the domain's constants. */
export const PORTFOLIO_MIN_ITEMS = 3;
export const PORTFOLIO_MAX_ITEMS = 8;
/** One caption, 200 characters at most (RG82). */
export const PORTFOLIO_CAPTION_MAX_LENGTH = 200;
/** The deposit: the raw bytes of ONE image, 8 MiB at most (the only exception to the 2 MiB of the relay, D82 (7)). */
export const PORTFOLIO_MAX_UPLOAD_BYTES = 8_388_608;
/** The stored WebP, at most (the limit of the bucket `portfolio`, 0242). */
export const PORTFOLIO_MAX_STORED_BYTES = 8_388_608;
/** Base64 of the largest stored WebP. */
export const PORTFOLIO_MAX_BASE64_LENGTH =
  Math.ceil(PORTFOLIO_MAX_STORED_BYTES / 3) * 4;

/**
 * The states of a visual a creator reads (EC-L2G-3, EC-L2G-10): those of the base but `uploading`
 * (the line before the object) and `purged` (the object is gone), which he never reads.
 */
export const PORTFOLIO_MEMBER_ITEM_STATES = [
  "pending",
  "approved",
  "rejected",
  "withdrawn",
  "purging",
] as const;
export const portfolioMemberItemStateSchema = z.enum(
  PORTFOLIO_MEMBER_ITEM_STATES,
);
export type PortfolioMemberItemState = z.infer<
  typeof portfolioMemberItemStateSchema
>;

/** The closed grid of the refusal of a visual (07 RG79, RG82, RG83): no `other`, no message to the member. */
export const PORTFOLIO_REJECTION_REASON_CODES = [
  "watermark",
  "handle_in_image",
  "app_interface",
  "text_naming_account_or_brand",
  "identifiable_place",
  "statistics_screenshot",
  "illicit_content",
  "caption_identifier",
  "caption_brand_unauthorised",
] as const;
export const portfolioRejectionReasonCodeSchema = z.enum(
  PORTFOLIO_REJECTION_REASON_CODES,
);
export type PortfolioRejectionReasonCode = z.infer<
  typeof portfolioRejectionReasonCodeSchema
>;

/** The longest side of a visual must reach it (the parameters of a piece, D82 (7); `portfolio_items_sides`, 0242). */
export const PORTFOLIO_MIN_SIDE = 320;
/** The longest side WebP can hold (`portfolio_items_sides`, 0242). */
export const PORTFOLIO_MAX_SIDE = 16_383;

/**
 * The reasons of an `image_rejected` on the deposit (path `portfolio`): no bytes, a type other than
 * PNG, JPEG or WebP (PDF and SVG included, T9.4), bytes that do not decode, more than 4 096² pixels or
 * a side over 16 383, a longest side under 320 px, an output over the limit of the bucket.
 */
export const PORTFOLIO_UPLOAD_REJECTIONS = [
  "empty",
  "unsupported_type",
  "undecodable",
  "too_many_pixels",
  "too_small",
  "output_too_large",
] as const;
export type PortfolioUploadRejection =
  (typeof PORTFOLIO_UPLOAD_REJECTIONS)[number];

/**
 * The issues of a 409 `conflict` on the portfolio routes, the DETAIL of the base (0242, 0243): path
 * `replaces` for the two refusals of a replacement (RG81), `portfolio` otherwise. `portfolio_full`:
 * eight places taken (RG77); `portfolio_minimum`: a published profile keeps three; `item_state`: the
 * visual is neither pending nor approved; `profile_state`: the profile is suspended.
 */
export const PORTFOLIO_CONFLICT_ISSUES = [
  "portfolio_full",
  "portfolio_minimum",
  "not_replaceable",
  "replacement_pending",
  "item_state",
  "profile_state",
] as const;
export type PortfolioConflictIssue = (typeof PORTFOLIO_CONFLICT_ISSUES)[number];

/** A caption: one line of 200 characters at most, never blank, no control character (RG82; 0242). */
export const portfolioCaptionSchema = z
  .string()
  .refine((value) => value.trim().length > 0, { message: "blank" })
  .refine((value) => !/\p{Cc}/u.test(value), { message: "control" })
  .refine((value) => [...value].length <= PORTFOLIO_CAPTION_MAX_LENGTH, {
    message: "too_long",
  });

/**
 * One visual of the portfolio, for its owner. `displayOrder` is the creator's order (1 to 8) while
 * the visual is pending or approved, null otherwise. `replacementPending`: a replacement of this
 * approved visual waits for its decision, the visual stays served meanwhile (RG81). `captionPending`:
 * a revision of its caption waits for review on a published profile (CA48). `reasonCode`
 * only on a refused visual; `deleteAfter`: the day the file of a refused or withdrawn visual is
 * removed (30 days, D79 (8)). The bytes are read by `…/:id/image`, never here.
 */
export const portfolioItemSchema = z.strictObject({
  id: z.uuid(),
  state: portfolioMemberItemStateSchema,
  displayOrder: z.number().int().min(1).max(PORTFOLIO_MAX_ITEMS).nullable(),
  caption: portfolioCaptionSchema.nullable(),
  /** The box of RG83 was ticked for this caption (declared, dated and kept by the base). */
  brandDeclared: z.boolean(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  byteSize: z.number().int().positive(),
  replacesItemId: z.uuid().nullable(),
  replacementPending: z.boolean(),
  captionPending: z.boolean(),
  reasonCode: portfolioRejectionReasonCodeSchema.nullable(),
  deleteAfter: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().nullable(),
});
export type PortfolioItem = z.infer<typeof portfolioItemSchema>;

/** `deposited` is the count of RG4 and RG88 (pending or approved, a replacement sharing the place of its original). */
export const portfolioResponseSchema = z.strictObject({
  items: z.array(portfolioItemSchema).max(64),
  deposited: z.number().int().min(0).max(PORTFOLIO_MAX_ITEMS),
});
export type PortfolioResponse = z.infer<typeof portfolioResponseSchema>;

/** The query of PUT …/portfolio: `replaces` names an approved visual of the account (RG81); the body is the raw file. */
export const portfolioUploadQuerySchema = z.strictObject({
  replaces: z.uuid().optional(),
});
export type PortfolioUploadQuery = z.infer<typeof portfolioUploadQuerySchema>;

/** The answer of PUT …/portfolio: the visual, now `pending`, and the score recomputed by the base (RG86, RG87). */
export const portfolioUploadResponseSchema = z.strictObject({
  item: portfolioItemSchema,
  deposited: z.number().int().min(0).max(PORTFOLIO_MAX_ITEMS),
  completeness: creatorProfileCompletenessSchema,
});
export type PortfolioUploadResponse = z.infer<
  typeof portfolioUploadResponseSchema
>;

export const portfolioItemParamsSchema = z.strictObject({ id: z.uuid() });
export type PortfolioItemParams = z.infer<typeof portfolioItemParamsSchema>;

/** PUT …/portfolio/order: the visuals deposited, in the creator's order; each one once. */
export const portfolioOrderBodySchema = z.strictObject({
  itemIds: z
    .array(z.uuid())
    .min(1)
    .max(PORTFOLIO_MAX_ITEMS)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "duplicate",
    }),
});
export type PortfolioOrderBody = z.infer<typeof portfolioOrderBodySchema>;

/**
 * PATCH …/portfolio/:id: the caption (null empties it) and the box of RG83, never pre-ticked: the
 * declaration means nothing without a caption. A caption of an approved visual of a published
 * profile waits for review (`revisionStatus` `pending_review`, the previous one stays shown).
 */
export const portfolioCaptionBodySchema = z
  .strictObject({
    caption: portfolioCaptionSchema.nullable(),
    brandDeclared: z.boolean(),
  })
  .refine((body) => body.caption !== null || !body.brandDeclared, {
    message: "declaration_without_caption",
    path: ["brandDeclared"],
  });
export type PortfolioCaptionBody = z.infer<typeof portfolioCaptionBodySchema>;

export const portfolioCaptionResponseSchema = z.strictObject({
  item: portfolioItemSchema,
  /** `applied`: the caption is the one shown; `pending_review`: it waits for an agent. */
  revisionStatus: z.enum(["applied", "pending_review"]),
});
export type PortfolioCaptionResponse = z.infer<
  typeof portfolioCaptionResponseSchema
>;

/** DELETE …/portfolio/:id: removal; a published profile keeps three at least (`portfolio_minimum`, RG77). */
export const portfolioRemovalResponseSchema = z.strictObject({
  deposited: z.number().int().min(0).max(PORTFOLIO_MAX_ITEMS),
  completeness: creatorProfileCompletenessSchema,
  profileStatus: creatorProfileStatusSchema,
});
export type PortfolioRemovalResponse = z.infer<
  typeof portfolioRemovalResponseSchema
>;

/**
 * GET …/portfolio/:id/image: the visual relayed as JSON like the logo (type, sides, base64 bounded),
 * for the screen to draw from a `blob:`. Never a key, an address of Storage or a token.
 */
export const portfolioImageResponseSchema = z.strictObject({
  contentType: z.literal("image/webp"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  byteSize: z.number().int().positive().max(PORTFOLIO_MAX_STORED_BYTES),
  data: z.base64().max(PORTFOLIO_MAX_BASE64_LENGTH),
});
export type PortfolioImageResponse = z.infer<
  typeof portfolioImageResponseSchema
>;
