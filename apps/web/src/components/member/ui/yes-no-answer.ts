// A yes/no question is a group of two radios (C21): the answer is a boolean for the screens, a code for the group.
import type { ChoiceOption } from "./choice-option";

/** The code of the "yes" radio. */
export const YES_CODE = "yes";
/** The code of the "no" radio. */
export const NO_CODE = "no";

/** The two radios of a yes/no question, the answer written in both. */
export function yesNoOptions(
  yesLabel: string,
  noLabel: string,
): readonly ChoiceOption[] {
  return [
    { code: YES_CODE, label: yesLabel },
    { code: NO_CODE, label: noLabel },
  ];
}

/** The code ticked for an answer; `null` while it is not answered. */
export function answerToCode(answer: boolean | null): string | null {
  return answer === null ? null : answer ? YES_CODE : NO_CODE;
}

/** The answer a ticked code gives. */
export function codeToAnswer(code: string): boolean {
  return code === YES_CODE;
}
