import type { Page } from "playwright";

import type { Account } from "./accounts.ts";
import type { MailSink } from "./mail.ts";
import { appearanceTimeout, field, fill, press, readyButton } from "./screens.ts";
import { currentTotpCode } from "./totp.ts";

interface Enrollment {
  readonly backupCodes: readonly string[];
  readonly uri: string;
}

interface Delivery {
  readonly account: Account;
  readonly mail: MailSink;
  readonly origin: string;
  readonly page: Page;
}

const signUpButton = "登録する";
const signInButton = "ログイン";
const totpChallengeButton = "確認コードでログイン";
const enrollButton = "認証アプリの登録を開始";
const activateButton = "確認して認証アプリを有効化";
const signOutButton = "ログアウト";
const totpLabel = "認証アプリの確認コード";
const homePattern = "/users/*";

async function signUp(page: Page, origin: string, account: Account): Promise<void> {
  await page.goto(`${origin}/signup`);
  await readyButton(page, signUpButton);
  await fill(page, "ユーザー名", account.name);
  await fill(page, "メールアドレス", account.email);
  await fill(page, "パスワード（12文字以上）", account.password);
  await press(page, signUpButton);
}

async function confirmEmail(delivery: Delivery): Promise<void> {
  const { account, mail, origin, page } = delivery;
  const link = await mail.waitForLink(account.email, `${origin}/verify-email`);
  await page.goto(link);
  await page.waitForURL(`${origin}/login`, { timeout: appearanceTimeout });
}

async function signIn(page: Page, origin: string, account: Account): Promise<void> {
  await page.goto(`${origin}/login`);
  await readyButton(page, signInButton);
  await fill(page, "メールアドレス", account.email);
  await fill(page, "パスワード", account.password);
  await press(page, signInButton);
}

async function answerTotpChallenge(page: Page, uri: string): Promise<void> {
  await readyButton(page, totpChallengeButton);
  await fill(page, totpLabel, currentTotpCode(uri));
  await press(page, totpChallengeButton);
}

async function beginEnrollment(page: Page, origin: string, account: Account): Promise<void> {
  await page.goto(`${origin}/security`);
  await readyButton(page, enrollButton);
  await fill(page, "設定変更を確認するパスワード", account.password);
  await press(page, enrollButton);
}

async function readEnrollment(page: Page): Promise<Enrollment> {
  const uriField = field(page, "認証アプリ登録用 URI");
  await uriField.waitFor({ state: "visible", timeout: appearanceTimeout });
  const codes = page.getByRole("list", { name: "バックアップコード" }).getByRole("listitem");
  return { backupCodes: await codes.allInnerTexts(), uri: await uriField.inputValue() };
}

async function enrollTotp(page: Page, origin: string, account: Account): Promise<Enrollment> {
  await beginEnrollment(page, origin, account);
  const enrollment = await readEnrollment(page);
  const stored = page.getByRole("checkbox", { name: "バックアップコードを保管しました" }).first();
  await stored.click();
  await fill(page, totpLabel, currentTotpCode(enrollment.uri));
  await press(page, activateButton);
  await page.waitForURL(`${origin}${homePattern}`, { timeout: appearanceTimeout });
  return enrollment;
}

async function signOut(page: Page, origin: string): Promise<void> {
  await page.goto(`${origin}/security`);
  await press(page, signOutButton);
  await page.waitForURL((url) => !url.pathname.startsWith("/security"), {
    timeout: appearanceTimeout,
  });
  await page.goto(`${origin}/login`);
  await readyButton(page, signInButton);
}

export { answerTotpChallenge, confirmEmail, enrollTotp, homePattern, signIn, signOut, signUp };
export type { Enrollment };
