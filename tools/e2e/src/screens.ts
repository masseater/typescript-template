import type { Locator, Page } from "playwright";

import { deadlineIn, until } from "./waiting.ts";

const hydrationTimeout = 60_000;
const appearanceTimeout = 60_000;

async function readyButton(page: Page, name: string): Promise<Locator> {
  const button = page.getByRole("button", { exact: true, name });
  await button.waitFor({ state: "visible", timeout: appearanceTimeout });
  await until(
    async () => (await button.isEnabled()) || undefined,
    deadlineIn(hydrationTimeout),
    "E2E_CONTROL_STAYED_DISABLED",
  );
  return button;
}

async function press(page: Page, name: string): Promise<void> {
  const button = await readyButton(page, name);
  await button.click();
}

function field(page: Page, label: string): Locator {
  return page.getByLabel(label, { exact: true }).first();
}

async function fill(page: Page, label: string, value: string): Promise<void> {
  const input = field(page, label);
  await input.waitFor({ state: "visible", timeout: appearanceTimeout });
  await input.fill(value);
}

async function seeHeading(page: Page, name: string): Promise<void> {
  const heading = page.getByRole("heading", { exact: true, name }).first();
  await heading.waitFor({ state: "visible", timeout: appearanceTimeout });
}

async function seeText(page: Page, text: string): Promise<void> {
  const shown = page.getByText(text, { exact: false }).first();
  await shown.waitFor({ state: "visible", timeout: appearanceTimeout });
}

async function seeAnyHeading(page: Page): Promise<void> {
  const heading = page.getByRole("heading", { level: 1 }).first();
  await heading.waitFor({ state: "visible", timeout: appearanceTimeout });
}

export { appearanceTimeout, field, fill, press, readyButton, seeAnyHeading, seeHeading, seeText };
