import { Effect } from "effect";

import { failed, type JourneyFailure } from "./journey-failure.ts";
import { deadlineIn, until } from "./waiting.ts";

import type { Locator, Page } from "playwright";

const hydrationTimeout = 60_000;
const appearanceTimeout = 60_000;

const pageStep = <Result>(run: () => Promise<Result>): Effect.Effect<Result, JourneyFailure> =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => failed("E2E_PAGE_STEP_FAILED", cause),
  });

const readyButton = (page: Page, buttonName: string): Effect.Effect<Locator, JourneyFailure> =>
  Effect.gen(function* waitForEnabledButton() {
    const button = page.getByRole("button", { exact: true, name: buttonName });
    yield* pageStep(() => button.waitFor({ state: "visible", timeout: appearanceTimeout }));
    yield* until({
      attempt: () =>
        pageStep(() => button.isEnabled()).pipe(Effect.map((enabled) => enabled || undefined)),
      deadline: deadlineIn(hydrationTimeout),
      reason: "E2E_CONTROL_STAYED_DISABLED",
    });
    return button;
  });

const press = (page: Page, buttonName: string): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* pressButton() {
    const button = yield* readyButton(page, buttonName);
    yield* pageStep(() => button.click());
  });

const field = (page: Page, fieldLabel: string): Locator =>
  page.getByLabel(fieldLabel, { exact: true }).first();

const fill = (
  page: Page,
  entered: { readonly fieldLabel: string; readonly typed: string },
): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* fillField() {
    const input = field(page, entered.fieldLabel);
    yield* pageStep(() => input.waitFor({ state: "visible", timeout: appearanceTimeout }));
    yield* pageStep(() => input.fill(entered.typed));
  });

const seeHeading = (page: Page, headingName: string): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* waitForHeading() {
    const heading = page.getByRole("heading", { exact: true, name: headingName }).first();
    yield* pageStep(() => heading.waitFor({ state: "visible", timeout: appearanceTimeout }));
  });

const seeText = (page: Page, shownText: string): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* waitForText() {
    const shown = page.getByText(shownText, { exact: false }).first();
    yield* pageStep(() => shown.waitFor({ state: "visible", timeout: appearanceTimeout }));
  });

const seeAnyHeading = (page: Page): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* waitForAnyHeading() {
    const heading = page.getByRole("heading", { level: 1 }).first();
    yield* pageStep(() => heading.waitFor({ state: "visible", timeout: appearanceTimeout }));
  });

export {
  appearanceTimeout,
  field,
  fill,
  pageStep,
  press,
  readyButton,
  seeAnyHeading,
  seeHeading,
  seeText,
};
