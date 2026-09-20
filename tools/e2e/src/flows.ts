import {
  appearanceTimeout,
  field,
  fill,
  press,
  readyButton,
  seeHeading,
  seeText,
} from "./screens.ts";
import { currentTotpCode } from "./totp.ts";

import type { Page } from "playwright";
import type { Account } from "./accounts.ts";
import type { MailSink } from "./mail.ts";

type Visit = {
  readonly account: Account;
  readonly origin: string;
  readonly page: Page;
};

const signUpButton = "登録する";

const signUp = async (visit: Visit): Promise<void> => {
  await visit.page.goto(`${visit.origin}/signup`);
  await readyButton(visit.page, signUpButton);
  await fill(visit.page, { fieldLabel: "ユーザー名", typed: visit.account.name });
  await fill(visit.page, { fieldLabel: "メールアドレス", typed: visit.account.email });
  await fill(visit.page, {
    fieldLabel: "パスワード（12文字以上）",
    typed: visit.account.password,
  });
  await press(visit.page, signUpButton);
};

const confirmEmail = async (delivery: Visit & { readonly mail: MailSink }): Promise<void> => {
  const link = await delivery.mail.waitForLink(
    delivery.account.email,
    `${delivery.origin}/verify-email`,
  );
  await delivery.page.goto(link);
  await delivery.page.waitForURL(`${delivery.origin}/login`, { timeout: appearanceTimeout });
};

const signInButton = "ログイン";

const signIn = async (visit: Visit): Promise<void> => {
  await visit.page.goto(`${visit.origin}/login`);
  await readyButton(visit.page, signInButton);
  await fill(visit.page, { fieldLabel: "メールアドレス", typed: visit.account.email });
  await fill(visit.page, { fieldLabel: "パスワード", typed: visit.account.password });
  await press(visit.page, signInButton);
};

const totpLabel = "認証アプリの確認コード";

const totpChallengeButton = "確認コードでログイン";

const answerTotpChallenge = async (page: Page, uri: string): Promise<void> => {
  await readyButton(page, totpChallengeButton);
  await fill(page, { fieldLabel: totpLabel, typed: currentTotpCode(uri) });
  await press(page, totpChallengeButton);
};

const enrollButton = "認証アプリの登録を開始";

const beginEnrollment = async (visit: Visit): Promise<void> => {
  await visit.page.goto(`${visit.origin}/settings/security`);
  await readyButton(visit.page, enrollButton);
  await fill(visit.page, {
    fieldLabel: "設定変更を確認するパスワード",
    typed: visit.account.password,
  });
  await press(visit.page, enrollButton);
};

type Enrollment = {
  readonly backupCodes: readonly string[];
  readonly uri: string;
};

const readEnrollment = async (page: Page): Promise<Enrollment> => {
  const uriField = field(page, "認証アプリ登録用 URI");
  await uriField.waitFor({ state: "visible", timeout: appearanceTimeout });
  const codes = page.getByRole("list", { name: "バックアップコード" }).getByRole("listitem");
  return { backupCodes: await codes.allInnerTexts(), uri: await uriField.inputValue() };
};

const activateButton = "確認して認証アプリを有効化";

const homePattern = "/home";

const enrollTotp = async (visit: Visit): Promise<Enrollment> => {
  await beginEnrollment(visit);
  const enrollment = await readEnrollment(visit.page);
  const stored = visit.page
    .getByRole("checkbox", { name: "バックアップコードを保管しました" })
    .first();
  await stored.click();
  await fill(visit.page, { fieldLabel: totpLabel, typed: currentTotpCode(enrollment.uri) });
  await press(visit.page, activateButton);
  await visit.page.waitForURL(`${visit.origin}${homePattern}`, { timeout: appearanceTimeout });
  return enrollment;
};

const signOutButton = "ログアウト";

const signOut = async (page: Page, origin: string): Promise<void> => {
  await page.goto(`${origin}/settings/security`, { waitUntil: "domcontentloaded" });
  await press(page, signOutButton);
  await page.waitForURL((url) => !url.pathname.startsWith("/settings/security"), {
    timeout: appearanceTimeout,
  });
  await page.goto(`${origin}/login`);
  await readyButton(page, signInButton);
};

const passkeyLoginButton = "パスキーでログイン";

const signInWithPasskey = async (visit: Visit): Promise<void> => {
  await visit.page.goto(`${visit.origin}/login`);
  await readyButton(visit.page, passkeyLoginButton);
  await press(visit.page, passkeyLoginButton);
  await visit.page.waitForURL(`${visit.origin}${homePattern}`, { timeout: appearanceTimeout });
};

const waitForPasskeyRegistration = (visit: Visit): ReturnType<Page["waitForResponse"]> =>
  visit.page.waitForResponse(
    (httpExchange) => httpExchange.url().includes("/passkey/verify-registration"),
    { timeout: appearanceTimeout },
  );

const waitForPasskeyOptions = (visit: Visit): ReturnType<Page["waitForResponse"]> =>
  visit.page.waitForResponse(
    (httpExchange) => httpExchange.url().includes("/passkey/generate-register-options"),
    { timeout: appearanceTimeout },
  );

const assertPasskeyHttpOk = async (
  httpExchange: Awaited<ReturnType<typeof waitForPasskeyOptions>>,
  failureLabel: string,
): Promise<void> => {
  if (!httpExchange.ok()) {
    throw new Error(`${failureLabel} ${httpExchange.status()} ${await httpExchange.text()}`);
  }
};

const submitPasskeyRegistration = async (visit: Visit, passkeyLabel: string): Promise<void> => {
  const generateOptionsHttpReply = waitForPasskeyOptions(visit);
  const verifyRegistrationHttpReply = waitForPasskeyRegistration(visit);
  await press(visit.page, "パスキーを登録");
  await assertPasskeyHttpOk(await generateOptionsHttpReply, "PASSKEY_OPTIONS_FAILED");
  await assertPasskeyHttpOk(await verifyRegistrationHttpReply, "PASSKEY_REGISTRATION_FAILED");
  await seeText(visit.page, passkeyLabel);
};

const registerPasskey = async (visit: Visit, passkeyLabel: string): Promise<void> => {
  await visit.page.goto(`${visit.origin}/settings/security`);
  await readyButton(visit.page, "パスキーを登録");
  await fill(visit.page, { fieldLabel: "パスキーの名前", typed: passkeyLabel });
  await submitPasskeyRegistration(visit, passkeyLabel);
};

const updateProfile = async (
  visit: Visit,
): Promise<{ readonly biography: string; readonly profilePath: string }> => {
  const biography = `verify ${crypto.randomUUID()}`;
  await visit.page.goto(`${visit.origin}/settings/profile`);
  await seeHeading(visit.page, "プロフィールの編集");
  await readyButton(visit.page, "保存");
  await fill(visit.page, { fieldLabel: "自己紹介", typed: biography });
  await press(visit.page, "保存");
  await visit.page.waitForURL(`${visit.origin}/users/*`, { timeout: appearanceTimeout });
  return { biography, profilePath: new URL(visit.page.url()).pathname };
};

export {
  answerTotpChallenge,
  confirmEmail,
  enrollTotp,
  homePattern,
  registerPasskey,
  signIn,
  signInWithPasskey,
  signOut,
  signUp,
  updateProfile,
};
