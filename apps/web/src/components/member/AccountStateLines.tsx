// The block of state of the account as both roles draw it in the aside of the shell (docs/mvp/17
// §2.3 "Bloc d'état du compte"; E01.0-S11 to S13, CA04): words and one link with a chevron (C11
// `go`), no pill nor gauge. What it says is decided by the block of each role. The link is the
// router's, with the classes of C11, so that the page is never reloaded.
import {
  ACCOUNT_STATE_CLASSES,
  ACCOUNT_STATE_MISSING_CLASSES,
  ACCOUNT_STATE_TITLE_CLASSES,
} from "@/components/member/shell-classes";
import {
  actionLinkChevronClasses,
  actionLinkClasses,
} from "@/components/member/ui/action-link-classes";
import { ChevronRightIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";

export type AccountStateLinesProps = {
  /** "Profile: <state>", already translated. */
  state: string;
  /** What is missing, or null when there is nothing to say. */
  missing: string | null;
  /** The way to the profile, or null once there is none to offer. */
  way: { href: string; label: string } | null;
};

export function AccountStateLines({
  state,
  missing,
  way,
}: AccountStateLinesProps) {
  return (
    <div className={ACCOUNT_STATE_CLASSES}>
      <p className={ACCOUNT_STATE_TITLE_CLASSES}>{state}</p>
      {missing === null ? null : (
        <p className={ACCOUNT_STATE_MISSING_CLASSES}>{missing}</p>
      )}
      {way === null ? null : (
        <Link href={way.href} className={actionLinkClasses("go", true)}>
          {way.label}
          <ChevronRightIcon
            aria-hidden="true"
            className={actionLinkChevronClasses(true)}
          />
        </Link>
      )}
    </div>
  );
}
