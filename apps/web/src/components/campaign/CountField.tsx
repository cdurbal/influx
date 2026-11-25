"use client";

// A whole number typed on the campaign form (docs/mvp/09 RG66, RG76; jalons/l3b, commit 10): the
// creators wanted, the ceiling of applications. Digits only: what is not a digit is dropped at the
// key, an empty field is "not entered" (null). The bounds are packages/domain's, said in the help and
// held by the schema of the API; a number outside them is refused as a field in error, never clamped.
import { TextField } from "@/components/member/ui/TextField";
import type { FieldTexts } from "@/components/member/ui/FieldFrame";

type CountFieldProps = FieldTexts & {
  id: string;
  name: string;
  value: number | null;
  onChange: (value: number | null) => void;
  /** The most digits a number of this field has (the bound's own length). */
  maxDigits: number;
};

export function CountField({
  value,
  onChange,
  maxDigits,
  ...rest
}: CountFieldProps) {
  return (
    <TextField
      {...rest}
      value={value === null ? "" : String(value)}
      maxLength={maxDigits}
      inputMode="numeric"
      onChange={(text) => {
        const digits = text.replace(/\D/gu, "");
        onChange(digits === "" ? null : Number(digits));
      }}
    />
  );
}
