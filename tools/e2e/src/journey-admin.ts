import {
  apiData,
  apiStatus,
  button,
  signOut,
  submitBackupCode,
  verifyRecoverySession,
} from "./journey-auth.ts";
import { ensure, inStage, object, string } from "./support.ts";
import type { BrowserSession } from "./browser.ts";
import type { CdpSession } from "./cdp.ts";
import type { UserJourney } from "./journey-user.ts";
import { enabledButton } from "./browser.ts";
import { httpStatus } from "./http.ts";
import { totp } from "./totp.ts";

interface AdminJourney {
  readonly admin: BrowserSession;
  readonly recoveringAdmin: BrowserSession;
}

interface Passkey {
  readonly authenticatorId: string;
  readonly cdp: CdpSession;
}

async function verifyWeakAdminDenied(admin: BrowserSession, password: string): Promise<void> {
  const users = await apiStatus(admin, "/api/users");
  ensure(users === httpStatus.forbidden, "E2E_WEAK_ADMIN_SESSION_ACCEPTED");
  const signUp = await apiStatus(admin, "/api/auth/sign-up/email", {
    body: { email: "forbidden@example.test", name: "Forbidden", password },
    method: "POST",
  });
  ensure(signUp >= httpStatus.badRequest, "E2E_PUBLIC_ADMIN_SIGNUP_ALLOWED");
}

async function verifyWeakAdmin(journey: UserJourney): Promise<BrowserSession> {
  const { owner, stack } = journey;
  await stack.bootstrap(owner.email);
  const admin = stack.browser("admin");
  await admin.commands(["set", "credentials", stack.basicUser, stack.basicPassword]);
  await admin.login(stack.adminOrigin, owner.email, owner.password);
  await admin.waitText("追加認証を完了してください。");
  await verifyWeakAdminDenied(admin, owner.password);
  return admin;
}

async function registerPasskey(journey: UserJourney, admin: BrowserSession): Promise<Passkey> {
  await admin.open(journey.stack.adminOrigin, "/security");
  await admin.commands(["wait", 'input[name="passkey-name"]'], enabledButton("パスキーを登録"));
  const cdp = await admin.connectCdp();
  const authenticatorId = await cdp.authenticator();
  await admin.commands(
    ["fill", 'input[name="passkey-name"]', "E2E hardware-backed protocol"],
    button("パスキーを登録"),
  );
  await admin.waitText("パスキーを登録しました。");
  const users = await apiStatus(admin, "/api/users");
  ensure(users === httpStatus.forbidden, "E2E_ENROLLMENT_SILENTLY_ELEVATES_SESSION");
  return { authenticatorId, cdp };
}

async function credentials(passkey: Passkey): Promise<unknown> {
  const result = await passkey.cdp.send("WebAuthn.getCredentials", {
    authenticatorId: passkey.authenticatorId,
  });
  return result["credentials"];
}

async function registeredSignCount(passkey: Passkey): Promise<number> {
  const registered = await credentials(passkey);
  ensure(
    Array.isArray(registered) && registered.length === 1,
    "E2E_PASSKEY_CREDENTIAL_NOT_CREATED",
  );
  const credential = object(registered[0]);
  ensure(typeof credential["privateKey"] === "string", "E2E_PASSKEY_PRIVATE_KEY_NOT_GENERATED");
  const { signCount } = credential;
  ensure(typeof signCount === "number", "E2E_PASSKEY_SIGN_COUNTER_MISSING");
  return signCount;
}

async function signCountIncreased(passkey: Passkey, before: number): Promise<boolean> {
  const after = await credentials(passkey);
  if (!Array.isArray(after)) {
    return false;
  }
  const { signCount } = object(after[0]);
  return typeof signCount === "number" && signCount > before;
}

async function passkeyLogin(journey: UserJourney & Pick<AdminJourney, "admin">): Promise<void> {
  const { admin, stack } = journey;
  const passkey = await registerPasskey(journey, admin);
  const before = await registeredSignCount(passkey);
  await admin.open(stack.adminOrigin, "/");
  await signOut(admin);
  await admin.commands(button("パスキーでログイン"), ["wait", "tbody tr"]);
  ensure(await signCountIncreased(passkey, before), "E2E_PASSKEY_SIGNATURE_NOT_PRODUCED");
  const users = await apiStatus(admin, "/api/users");
  ensure(users === httpStatus.ok, "E2E_PASSKEY_ADMIN_LOGIN_FAILED");
}

async function promoteAlice(journey: UserJourney & Pick<AdminJourney, "admin">): Promise<void> {
  const { admin, alice, aliceBrowser } = journey;
  await admin.waitText(alice.email);
  await admin.commands(button(`${alice.email} を管理者に変更`), ["dialog", "accept"]);
  await admin.waitText("権限を変更しました。既存セッションは失効しました。");
  const profile = await apiStatus(aliceBrowser, "/api/profile");
  ensure(profile === httpStatus.unauthorized, "E2E_ROLE_CHANGE_DID_NOT_REVOKE_SESSION");
}

async function verifyRecoveryAdminDenied(
  journey: UserJourney,
  browser: BrowserSession,
): Promise<void> {
  const read = await apiStatus(browser, "/api/users");
  ensure(read === httpStatus.forbidden, "E2E_RECOVERY_ADMIN_READ_ALLOWED");
  const promote = await apiStatus(browser, "/api/users", {
    body: { id: journey.bobId, role: "admin" },
    method: "PATCH",
  });
  ensure(promote === httpStatus.forbidden, "E2E_RECOVERY_ADMIN_ROLE_CHANGE_ALLOWED");
  const remove = await apiStatus(browser, "/api/users", {
    body: { id: journey.bobId },
    method: "DELETE",
  });
  ensure(remove === httpStatus.forbidden, "E2E_RECOVERY_ADMIN_DELETE_ALLOWED");
}

async function strongAdminRelogin(journey: UserJourney, browser: BrowserSession): Promise<void> {
  const { alice, restoredEnrollment, stack } = journey;
  await signOut(browser);
  await browser.login(stack.adminOrigin, alice.email, alice.password);
  await browser.commands(
    ["wait", 'input[name="totp"]'],
    ["fill", 'input[name="totp"]', totp(restoredEnrollment.uri)],
  );
  await browser.submitAuthentication("/api/auth/two-factor/verify-totp", [
    button("確認コードでログイン"),
  ]);
  await browser.commands(["wait", "tbody tr"]);
  const users = await apiStatus(browser, "/api/users");
  ensure(users === httpStatus.ok, "E2E_RECOVERY_ADMIN_STRONG_RELOGIN_FAILED");
}

async function recoverAdmin(journey: UserJourney): Promise<BrowserSession> {
  const { alice, restoredEnrollment, stack } = journey;
  const recoveringAdmin = stack.browser("recovering-admin");
  await recoveringAdmin.commands(["set", "credentials", stack.basicUser, stack.basicPassword]);
  await submitBackupCode(
    recoveringAdmin,
    { account: alice, origin: stack.adminOrigin },
    string(restoredEnrollment.backupCodes[0]),
  );
  await verifyRecoverySession(recoveringAdmin);
  await recoveringAdmin.waitText("復旧コードでは管理者操作はできません。");
  await verifyRecoveryAdminDenied(journey, recoveringAdmin);
  await strongAdminRelogin(journey, recoveringAdmin);
  return recoveringAdmin;
}

async function protectLastAdmin(journey: UserJourney & Pick<AdminJourney, "admin">): Promise<void> {
  const { admin, aliceId, ownerId } = journey;
  const demoteAlice = await apiStatus(admin, "/api/users", {
    body: { id: aliceId, role: "user" },
    method: "PATCH",
  });
  ensure(demoteAlice === httpStatus.ok, "E2E_ADMIN_DEMOTION_FAILED");
  const demoteOwner = await apiStatus(admin, "/api/users", {
    body: { id: ownerId, role: "user" },
    method: "PATCH",
  });
  ensure(demoteOwner === httpStatus.conflict, "E2E_LAST_ADMIN_DEMOTION_ALLOWED");
  const deleteOwner = await apiStatus(admin, "/api/users", {
    body: { id: ownerId },
    method: "DELETE",
  });
  ensure(deleteOwner === httpStatus.conflict, "E2E_LAST_ADMIN_DELETION_ALLOWED");
}

async function deleteBob(journey: UserJourney & Pick<AdminJourney, "admin">): Promise<void> {
  const { admin, bob, bobBrowser, bobId } = journey;
  await protectLastAdmin(journey);
  await admin.commands(button(`${bob.email} を削除`), ["dialog", "accept"]);
  await admin.waitText("ユーザーを削除しました。");
  const profile = await apiStatus(bobBrowser, "/api/profile");
  ensure(profile === httpStatus.unauthorized, "E2E_DELETED_USER_SESSION_VALID");
  const { users } = await apiData(admin, "/api/users");
  ensure(
    Array.isArray(users) && !users.some((user: unknown) => object(user)["id"] === bobId),
    "E2E_DELETED_USER_STILL_LISTED",
  );
  const signIn = await apiStatus(bobBrowser, "/api/auth/sign-in/email", {
    body: { email: bob.email, password: bob.password },
    method: "POST",
  });
  ensure(signIn >= httpStatus.badRequest, "E2E_DELETED_USER_CAN_LOGIN");
}

async function adminJourney(journey: UserJourney): Promise<AdminJourney> {
  const admin = await inStage("admin-weak-auth", verifyWeakAdmin, journey);
  const withAdmin = { ...journey, admin };
  await inStage("passkey", passkeyLogin, withAdmin);
  await inStage("admin-lifecycle", promoteAlice, withAdmin);
  const recoveringAdmin = await inStage("admin-backup-code-recovery", recoverAdmin, journey);
  await inStage("admin-lifecycle", deleteBob, withAdmin);
  return { admin, recoveringAdmin };
}

export { adminJourney };
export type { AdminJourney };
