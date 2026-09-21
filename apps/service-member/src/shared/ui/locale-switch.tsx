import { getLocale, locales, m, setLocale, type Locale } from "#shared/i18n/index.ts";

import type { ReactElement } from "react";

const localeLabel = (locale: Locale): string => {
  switch (locale) {
    case "en":
      return m.locale_en();
    case "ja":
      return m.locale_ja();
  }
};

function LocaleSwitch(): ReactElement {
  return (
    <label className="flex items-center gap-2 text-sm leading-normal text-muted-foreground">
      <span>{m.locale_label()}</span>
      <select
        className="rounded-md border border-border bg-card px-2 py-1 text-foreground"
        value={getLocale()}
        onChange={(event) => {
          void setLocale(event.currentTarget.value as Locale);
        }}
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeLabel(locale)}
          </option>
        ))}
      </select>
    </label>
  );
}

export { LocaleSwitch };
