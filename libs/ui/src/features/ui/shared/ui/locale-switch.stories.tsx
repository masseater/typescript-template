import { Effect } from "effect";
import { expect, fn, userEvent } from "storybook/test";

import preview, { playTask } from "../../../../../storybook/preview";
import { LocaleSwitch } from "./locale-switch";

const meta = preview.meta({
  args: {
    i18n: {
      getLocale: () => "ja",
      locales: ["ja", "en"],
      m: { locale_en: () => "English", locale_ja: () => "日本語", locale_label: () => "言語" },
      setLocale: fn<(locale: string) => void>(),
    },
  },
  component: LocaleSwitch,
});

export const Default = meta.story();

export const Selects = meta.story({
  play: ({ args, canvas }) =>
    Effect.runPromise(
      Effect.gen(function* selectEnglish() {
        yield* playTask(() => userEvent.selectOptions(canvas.getByRole("combobox"), "en"));
        yield* playTask(() => expect(args.i18n.setLocale).toHaveBeenCalledWith("en"));
      }),
    ),
});
