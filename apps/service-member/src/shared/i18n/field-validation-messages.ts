import { localizedFieldValidationMessages } from "@repo/ui";

import { m } from "#paraglide/messages.js";

import type { Locale } from "#paraglide/runtime.js";
import type { FieldValidationMessages } from "@repo/ui";

const fieldValidationMessages = (locale: Locale): FieldValidationMessages =>
  localizedFieldValidationMessages(m, locale);

export { fieldValidationMessages };
