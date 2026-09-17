import type { Account, Stack } from "./stack.ts";
import type { Enrollment, Login } from "./journey-auth.ts";
import {
  apiData,
  apiStatus,
  button,
  cookieAudienceDenied,
  enrollTotp,
  signOut,
  submitBackupCode,
  totpLogin,
  verifyRecoverySession,
  waitForClearedProfile,
} from "./journey-auth.ts";
import { ensure, inStage, object, string } from "./support.ts";
import type { BrowserSession } from "./browser.ts";
import { currentSecond } from "./telemetry.ts";
import { enabledButton } from "./browser.ts";
import { httpStatus } from "./http.ts";
import { randomUUID } from "node:crypto";
import { totp } from "./totp.ts";
import { verifyDistribution } from "./distribution.ts";
import { verifyEmail } from "./mail.ts";

interface Participants {
  readonly alice: Account;
  readonly aliceBrowser: BrowserSession;
  readonly aliceId: string;
  readonly anonymous: BrowserSession;
  readonly bob: Account;
  readonly bobBrowser: BrowserSession;
  readonly bobId: string;
  readonly owner: Account;
  readonly ownerId: string;
  readonly ownerUser: BrowserSession;
  readonly stack: Stack;
  readonly started: number;
}

interface UserJourney extends Participants {
  readonly originalEnrollment: Enrollment;
  readonly profile: string;
  readonly restoredEnrollment: Enrollment;
}

async function signUp(stack: Stack, browser: BrowserSession, account: Account): Promise<void> {
  await browser.open(stack.userOrigin, "/signup");
  await browser.commands(
    ["wait", 'input[name="name"]'],
    enabledButton("登録して確認メールを送信"),
    ["fill", 'input[name="name"]', account.name],
    ["fill", 'input[name="email"]', account.email],
    ["fill", 'input[name="password"]', account.password],
    button("登録して確認メールを送信"),
  );
  await browser.waitText("確認メールを送信しました。");
  const unverified = await apiStatus(browser, "/api/auth/sign-in/email", {
    body: { email: account.email, password: account.password },
    method: "POST",
  });
  ensure(unverified === httpStatus.forbidden, "E2E_UNVERIFIED_EMAIL_LOGIN_ALLOWED");
}

async function register(stack: Stack, browser: BrowserSession, account: Account): Promise<string> {
  await signUp(stack, browser, account);
  await verifyEmail(browser, {
    email: account.email,
    origin: stack.userOrigin,
    ownMessage: stack.ownMessage,
  });
  await browser.login(stack.userOrigin, account.email, account.password);
  await browser.commands(["wait", 'textarea[name="profile"]']);
  const response = await browser.api("/api/session");
  ensure(response.status === httpStatus.ok, "E2E_VERIFIED_LOGIN_FAILED");
  return string(object(object(response.data)["user"])["id"]);
}

async function verifyAnonymousAccess(stack: Stack): Promise<BrowserSession> {
  await verifyDistribution(stack.userOrigin, stack.adminOrigin);
  const anonymous = stack.browser("anonymous");
  await anonymous.open(stack.userOrigin, "/login");
  const status = await apiStatus(anonymous, "/api/profile");
  ensure(status === httpStatus.unauthorized, "E2E_ANONYMOUS_PROFILE_ALLOWED");
  return anonymous;
}

async function registeredParticipant(
  stack: Stack,
  names: Readonly<{ account: string; browser: string }>,
): Promise<Readonly<{ account: Account; browser: BrowserSession; id: string }>> {
  const account = stack.account(names.account);
  const browser = stack.browser(names.browser);
  const id = await register(stack, browser, account);
  return { account, browser, id };
}

async function registerParticipants(
  context: Pick<Participants, "anonymous" | "stack" | "started">,
): Promise<Participants> {
  const { stack } = context;
  const owner = await registeredParticipant(stack, { account: "owner", browser: "owner-user" });
  const alice = await registeredParticipant(stack, { account: "alice", browser: "alice" });
  const bob = await registeredParticipant(stack, { account: "bob", browser: "bob" });
  return {
    ...context,
    alice: alice.account,
    aliceBrowser: alice.browser,
    aliceId: alice.id,
    bob: bob.account,
    bobBrowser: bob.browser,
    bobId: bob.id,
    owner: owner.account,
    ownerId: owner.id,
    ownerUser: owner.browser,
  };
}

async function saveProfile(journey: Participants): Promise<string> {
  const profile = `自己紹介 日本語 العربية 🌱 ${randomUUID()}`;
  const { aliceBrowser, stack } = journey;
  await aliceBrowser.commands(
    ["fill", 'input[name="name"]', "E2E Alice"],
    ["fill", 'textarea[name="profile"]', profile],
    button("保存"),
  );
  await aliceBrowser.waitText("プロフィールを保存しました。");
  await aliceBrowser.open(stack.userOrigin, "/");
  await aliceBrowser.commands(["wait", 'textarea[name="profile"]']);
  const persisted = await aliceBrowser.evaluate(
    'document.querySelector("textarea[name=profile]").value',
  );
  ensure(persisted === profile, "E2E_PROFILE_NOT_PERSISTED");
  return profile;
}

async function verifyProfileNotShared(journey: Participants, profile: string): Promise<void> {
  const { aliceBrowser, aliceId, bobBrowser, bobId } = journey;
  const bobRead = await apiData(bobBrowser, `/api/profile?id=${encodeURIComponent(aliceId)}`);
  ensure(bobRead["id"] === bobId, "E2E_PROFILE_IDOR_READ");
  const bobWrite = await apiStatus(bobBrowser, "/api/profile", {
    body: { id: aliceId, name: "unauthorized", profile: "unauthorized" },
    method: "PATCH",
  });
  ensure(bobWrite === httpStatus.badRequest, "E2E_PROFILE_IDOR_WRITE");
  const aliceRead = await apiData(aliceBrowser, "/api/profile");
  ensure(aliceRead["profile"] === profile, "E2E_OTHER_USER_CHANGED_PROFILE");
}

async function profileIsolation(journey: Participants): Promise<string> {
  const profile = await saveProfile(journey);
  await verifyProfileNotShared(journey, profile);
  await journey.aliceBrowser.commands(
    ["fill", 'textarea[name="profile"]', "x"],
    ["press", "Backspace"],
    button("保存"),
  );
  await waitForClearedProfile(journey.aliceBrowser);
  await cookieAudienceDenied(journey.aliceBrowser, journey.stack);
  return profile;
}

async function totpEnrollment(journey: Participants): Promise<Enrollment> {
  const { alice, aliceBrowser, stack } = journey;
  const enrollment = await enrollTotp(aliceBrowser, stack.userOrigin, alice.password);
  await signOut(aliceBrowser);
  await totpLogin(aliceBrowser, { account: alice, origin: stack.userOrigin }, enrollment.uri);
  return enrollment;
}

async function recoverWithBackupCode(
  browser: BrowserSession,
  login: Login,
  code: string,
): Promise<void> {
  await signOut(browser);
  await submitBackupCode(browser, login, code);
  await verifyRecoverySession(browser);
}

async function rejectReusedBackupCode(
  journey: Participants,
  enrollment: Enrollment,
): Promise<void> {
  const { alice, aliceBrowser, stack } = journey;
  const login = { account: alice, origin: stack.userOrigin };
  const usedCode = string(enrollment.backupCodes[0]);
  await recoverWithBackupCode(aliceBrowser, login, usedCode);
  await signOut(aliceBrowser);
  await submitBackupCode(aliceBrowser, login, usedCode);
  await aliceBrowser.commands(["wait", '[role="alert"]']);
  const status = await apiStatus(aliceBrowser, "/api/session");
  ensure(status === httpStatus.unauthorized, "E2E_BACKUP_CODE_REUSED");
}

async function recoverWithNextBackupCode(
  journey: Participants,
  enrollment: Enrollment,
): Promise<void> {
  const { alice, aliceBrowser, stack } = journey;
  await aliceBrowser.commands(button("認証アプリのコードを使う"), [
    "fill",
    'input[name="totp"]',
    totp(enrollment.uri),
  ]);
  await aliceBrowser.submitAuthentication("/api/auth/two-factor/verify-totp", [
    button("確認コードでログイン"),
  ]);
  await aliceBrowser.commands(["wait", 'textarea[name="profile"]']);
  await recoverWithBackupCode(
    aliceBrowser,
    { account: alice, origin: stack.userOrigin },
    string(enrollment.backupCodes[1]),
  );
}

async function replaceAuthenticator(journey: Participants): Promise<Enrollment> {
  const { alice, aliceBrowser, stack } = journey;
  await aliceBrowser.commands(
    enabledButton("認証アプリを解除"),
    ["fill", 'input[name="password"]', alice.password],
    button("認証アプリを解除"),
    ["wait", "--url", "**/login?recovery=setup"],
    ["wait", 'input[name="email"]'],
    enabledButton("ログイン"),
    ["fill", 'input[name="email"]', alice.email],
    ["fill", 'input[name="password"]', alice.password],
    button("ログイン"),
  );
  await aliceBrowser.waitText("新しい認証アプリを登録してください。");
  const restored = await enrollTotp(aliceBrowser, stack.userOrigin, alice.password);
  await signOut(aliceBrowser);
  await totpLogin(aliceBrowser, { account: alice, origin: stack.userOrigin }, restored.uri);
  return restored;
}

async function backupCodeRecovery(
  journey: Participants & Pick<UserJourney, "originalEnrollment">,
): Promise<Enrollment> {
  await rejectReusedBackupCode(journey, journey.originalEnrollment);
  await recoverWithNextBackupCode(journey, journey.originalEnrollment);
  return replaceAuthenticator(journey);
}

async function userJourney(stack: Stack): Promise<UserJourney> {
  const started = currentSecond();
  const anonymous = await inStage("distribution", verifyAnonymousAccess, stack);
  const participants = await inStage("registration", registerParticipants, {
    anonymous,
    stack,
    started,
  });
  const profile = await inStage("profile-isolation", profileIsolation, participants);
  const originalEnrollment = await inStage("totp", totpEnrollment, participants);
  const restoredEnrollment = await inStage("backup-code-recovery", backupCodeRecovery, {
    ...participants,
    originalEnrollment,
  });
  return { ...participants, originalEnrollment, profile, restoredEnrollment };
}

export { userJourney };
export type { UserJourney };
