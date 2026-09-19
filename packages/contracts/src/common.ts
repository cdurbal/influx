import { z } from "zod";

export const LanguageSchema = z.enum(["fr", "en"]);
export type Language = z.infer<typeof LanguageSchema>;

export const CurrencySchema = z.enum(["EUR", "USD", "CAD", "GBP", "BRL"]);
export type Currency = z.infer<typeof CurrencySchema>;

export const CountryCodeSchema = z.string().length(2).toUpperCase();
export type CountryCode = z.infer<typeof CountryCodeSchema>;

export const MonetaryAmountSchema = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency: CurrencySchema,
});
export type MonetaryAmount = z.infer<typeof MonetaryAmountSchema>;

export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T,
) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    totalPages: z.number().int().nonnegative(),
  });
