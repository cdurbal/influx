import type { Messages } from "./messages";
import type { AppLocale } from "./routing";

// Typed keys: an unknown key in t("…") is a compile-time error (01 §5).
declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: Messages;
  }
}
