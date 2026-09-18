import { chromium } from "playwright";
import { describe, expect, test } from "vite-plus/test";

import { newAccount } from "./accounts.ts";
import { browserHeaders } from "./client-address.ts";
import { startJourneyEnvironment } from "./environment.ts";
import {
  answerTotpChallenge,
  confirmEmail,
  enrollTotp,
  homePattern,
  signIn,
  signOut,
  signUp,
} from "./flows.ts";
import {
  appearanceTimeout,
  fill,
  press,
  readyButton,
  seeAnyHeading,
  seeHeading,
  seeText,
} from "./screens.ts";

import type { Browser, Page } from "playwright";
import type { Account } from "./accounts.ts";
import type { JourneyEnvironment } from "./environment.ts";
import type { Enrollment } from "./flows.ts";

interface JourneyFixtures {
  readonly browser: Browser;
  readonly environment: JourneyEnvironment;
  readonly page: Page;
}

interface Step {
  readonly account: Account;
  readonly origin: string;
  readonly page: Page;
}

const minimumBackupCodes = 2;

const it = test.extend<JourneyFixtures>({
  browser: [
    async ({}, supply): Promise<void> => {
      const browser = await chromium.launch();
      await supply(browser);
      await browser.close();
    },
    { scope: "worker" },
  ],
  environment: [
    async ({}, supply): Promise<void> => {
      const environment = await startJourneyEnvironment();
      await supply(environment);
      await environment.stop();
    },
    { scope: "worker" },
  ],
  page: async ({ browser }, supply): Promise<void> => {
    const context = await browser.newContext({
      extraHTTPHeaders: browserHeaders(),
      locale: "ja-JP",
    });
    await supply(await context.newPage());
    await context.close();
  },
});

async function register(environment: JourneyEnvironment, step: Step): Promise<void> {
  const { account, origin, page } = step;
  await signUp(page, origin, account);
  await seeHeading(page, "確認メールを送りました");
  await confirmEmail({ account, mail: environment.mail, origin, page });
  await signIn(page, origin, account);
  await page.waitForURL(`${origin}${homePattern}`, { timeout: appearanceTimeout });
}

async function browseMainScreens(step: Step): Promise<void> {
  const { account, origin, page } = step;
  await seeHeading(page, account.name);
  await page.goto(`${origin}/users`);
  await seeHeading(page, "ユーザーを探す");
  const home = page.getByRole("link", { exact: true, name: "ホーム" }).first();
  await home.click();
  await seeHeading(page, account.name);
}

async function writeBiography(step: Step, biography: string): Promise<void> {
  const { origin, page } = step;
  await page.goto(`${origin}/settings/profile`);
  await seeHeading(page, "プロフィールの編集");
  await readyButton(page, "保存");
  await fill(page, "自己紹介", biography);
  await press(page, "保存");
  await page.waitForURL(`${origin}${homePattern}`, { timeout: appearanceTimeout });
  await seeText(page, biography);
}

async function becomeOperator(environment: JourneyEnvironment, step: Step): Promise<void> {
  const { account, origin, page } = step;
  const enrollment = await enrollTotp(page, origin, account);
  await environment.promoteToAdministrator(account.email);
  await signIn(page, environment.originOf("operator"), account);
  await answerTotpChallenge(page, enrollment.uri);
}

async function readDocument(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await seeAnyHeading(page);
}

async function returnWithTotp(
  step: Step,
  enrollment: Enrollment,
  biography: string,
): Promise<void> {
  const { account, origin, page } = step;
  await signOut(page, origin);
  await signIn(page, origin, account);
  await answerTotpChallenge(page, enrollment.uri);
  await page.waitForURL(`${origin}${homePattern}`, { timeout: appearanceTimeout });
  await seeText(page, biography);
}

describe("アプリ全体の導線", () => {
  it("利用者は登録から確認メール・ログイン・プロフィール更新・二要素まで辿れる", async ({
    environment,
    page,
  }) => {
    expect.hasAssertions();
    const origin = environment.originOf("member");
    const step = { account: newAccount("member"), origin, page };
    const biography = `journey ${crypto.randomUUID()}`;
    await register(environment, step);
    await browseMainScreens(step);
    await writeBiography(step, biography);
    const enrollment = await enrollTotp(page, origin, step.account);
    expect(enrollment.backupCodes.length).toBeGreaterThanOrEqual(minimumBackupCodes);
    await returnWithTotp(step, enrollment, biography);
  });

  it("管理者は二要素を済ませた上で利用者一覧を開ける", async ({ environment, page }) => {
    expect.hasAssertions();
    const operatorOrigin = environment.originOf("operator");
    const step = { account: newAccount("operator"), origin: environment.originOf("member"), page };
    await register(environment, step);
    await becomeOperator(environment, step);
    await seeHeading(page, "ユーザー一覧");
    await seeText(page, step.account.email);
    expect(new URL(page.url()).origin).toBe(operatorOrigin);
  });

  it("誰でも読める資料は複数ページと認証画面を配る", async ({ environment, page }) => {
    expect.hasAssertions();
    const origin = environment.originOf("knowledge");
    const [first = "", second = ""] = environment.documents;
    await readDocument(page, `${origin}${first}`);
    await readDocument(page, `${origin}${second}`);
    await page.goto(`${origin}/login`);
    const address = page.getByLabel("メールアドレス", { exact: true }).first();
    await address.waitFor({ state: "visible", timeout: appearanceTimeout });
    expect(new URL(page.url()).pathname).toBe("/login");
  });
});
