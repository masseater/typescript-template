import { deadlineIn, until } from "./waiting.ts";

import type { Locator, Page } from "playwright";

const hydrationTimeout = 60_000;
const appearanceTimeout = 60_000;

const readyButton = async (page: Page, buttonName: string): Promise<Locator> => {
  const button = page.getByRole("button", { exact: true, name: buttonName });
  await button.waitFor({ state: "visible", timeout: appearanceTimeout });
  await until({
    attempt: async () => (await button.isEnabled()) || undefined,
    deadline: deadlineIn(hydrationTimeout),
    reason: "E2E_CONTROL_STAYED_DISABLED",
  });
  return button;
};

const press = async (page: Page, buttonName: string): Promise<void> => {
  const button = await readyButton(page, buttonName);
  await button.click();
};

const field = (page: Page, fieldLabel: string): Locator => {
  return page.getByLabel(fieldLabel, { exact: true }).first();
};

const fill = async (
  page: Page,
  entered: { readonly fieldLabel: string; readonly typed: string },
): Promise<void> => {
  const input = field(page, entered.fieldLabel);
  await input.waitFor({ state: "visible", timeout: appearanceTimeout });
  await input.fill(entered.typed);
};

const seeHeading = async (page: Page, headingName: string): Promise<void> => {
  const heading = page.getByRole("heading", { exact: true, name: headingName }).first();
  await heading.waitFor({ state: "visible", timeout: appearanceTimeout });
};

const seeText = async (page: Page, shownText: string): Promise<void> => {
  const shown = page.getByText(shownText, { exact: false }).first();
  await shown.waitFor({ state: "visible", timeout: appearanceTimeout });
};

const seeAnyHeading = async (page: Page): Promise<void> => {
  const heading = page.getByRole("heading", { level: 1 }).first();
  await heading.waitFor({ state: "visible", timeout: appearanceTimeout });
};

export { appearanceTimeout, field, fill, press, readyButton, seeAnyHeading, seeHeading, seeText };
