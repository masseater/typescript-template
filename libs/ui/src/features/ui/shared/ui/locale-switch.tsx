import type { ReactElement } from "react";

const LocaleSwitch = <Locale extends string>({
  i18n,
}: Readonly<{
  i18n: Readonly<{
    getLocale: () => Locale;
    locales: readonly Locale[];
    m: Readonly<Record<"locale_label" | `locale_${Locale}`, () => string>>;
    setLocale: (locale: Locale) => unknown;
  }>;
}>): ReactElement => (
  <label className="flex items-center gap-2 text-sm leading-normal text-muted-foreground">
    <span>{i18n.m.locale_label()}</span>
    <select
      className="rounded-md border border-border bg-card px-2 py-1 text-foreground"
      value={i18n.getLocale()}
      onChange={(change) => {
        const selected = i18n.locales.find((locale) => locale === change.currentTarget.value);
        if (selected !== undefined) {
          void i18n.setLocale(selected);
        }
      }}
    >
      {i18n.locales.map((locale) => (
        <option key={locale} value={locale}>
          {i18n.m[`locale_${locale}`]()}
        </option>
      ))}
    </select>
  </label>
);

export { LocaleSwitch };
