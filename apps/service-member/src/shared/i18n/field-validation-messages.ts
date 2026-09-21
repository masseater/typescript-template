import { m } from "#paraglide/messages.js";

import type { Locale } from "#paraglide/runtime.js";
import type { FieldValidationMessages } from "@repo/ui";

const fieldValidationMessages = (locale: Locale): FieldValidationMessages => ({
  patternMismatch: m.field_pattern_mismatch({}, { locale }),
  tooLong: m.field_too_long({}, { locale }),
  tooShort: m.field_too_short({}, { locale }),
  typeMismatch: m.field_type_mismatch({}, { locale }),
  valueMissing: m.field_value_missing({}, { locale }),
});

export { fieldValidationMessages };
