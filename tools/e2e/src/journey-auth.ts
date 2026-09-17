import type { BrowserCommand, BrowserSession } from "./browser.ts";
import { ensure, object, poll, string } from "./support.ts";
import { httpStatus, requestTimeout } from "./http.ts";
import type { Account } from "./stack.ts";
import { enabledButton } from "./browser.ts";
import { totp } from "./totp.ts";

interface Login {
  readonly account: Account;
  readonly origin: string;
}

interface Enrollment {
  readonly backupCodes: readonly string[];
  readonly uri: string;
}

interface ApiRequest {
  readonly body?: unknown;
  readonly method?: string;
}

interface BasicCredentials {
  readonly adminOrigin: string;
  readonly basicPassword: string;
  readonly basicUser: string;
}

const minimumBackupCodes = 2;
const deniedStatuses = new Set<number>([httpStatus.unauthorized, httpStatus.forbidden]);

function button(name: string): BrowserCommand {
  return ["find", "role", "button", "click", "--name", name, "--exact"];
}

async function apiStatus(
  browser: BrowserSession,
  pathname: string,
  request: ApiRequest = {},
): Promise<number> {
  const response = await browser.api(pathname, request);
  return response.status;
}

async function apiData(
  browser: BrowserSession,
  pathname: string,
): Promise<Record<string, unknown>> {
  const response = await browser.api(pathname);
  return object(response.data);
}

async function signOut(browser: BrowserSession): Promise<void> {
  await browser.commands(button("ログアウト"), ["wait", 'input[name="email"]']);
}

async function backupCodesOnPage(browser: BrowserSession): Promise<string[]> {
  const codes = await browser.evaluate(
    'Array.from(document.querySelectorAll("[aria-label=バックアップコード] code"), node => node.textContent)',
  );
  ensure(Array.isArray(codes) && codes.length >= minimumBackupCodes, "E2E_BACKUP_CODES_MISSING");
  return codes.map((code: unknown) => string(code));
}

async function enrollTotp(
  browser: BrowserSession,
  origin: string,
  password: string,
): Promise<Enrollment> {
  await browser.open(origin, "/security");
  await browser.commands(
    ["wait", 'input[name="password"]'],
    enabledButton("認証アプリの登録を開始"),
    ["fill", 'input[name="password"]', password],
    button("認証アプリの登録を開始"),
    ["wait", "#totp-uri"],
  );
  const uri = string(await browser.evaluate('document.querySelector("#totp-uri").value'));
  const backupCodes = await backupCodesOnPage(browser);
  await browser.commands(
    ["check", 'input[type="checkbox"]'],
    ["fill", 'input[name="totp"]', totp(uri)],
    button("確認して認証アプリを有効化"),
    ["wait", 'textarea[name="profile"]'],
  );
  const session = await apiData(browser, "/api/session");
  ensure(session["strong"] === true, "E2E_TOTP_ENROLLMENT_NOT_STRONG");
  return { backupCodes, uri };
}

async function submitBackupCode(
  browser: BrowserSession,
  login: Login,
  code: string,
): Promise<void> {
  await browser.login(login.origin, login.account.email, login.account.password);
  await browser.commands(["wait", 'input[name="totp"]'], button("バックアップコードを使う"), [
    "fill",
    'input[name="backup-code"]',
    code,
  ]);
  await browser.submitAuthentication("/api/auth/two-factor/verify-backup-code", [
    button("バックアップコードでログイン"),
  ]);
}

async function verifyRecoverySession(browser: BrowserSession): Promise<void> {
  await browser.waitText("バックアップコードでログインしました。");
  const response = await browser.api("/api/session");
  ensure(response.status === httpStatus.ok, "E2E_RECOVERY_SESSION_MISSING");
  ensure(object(response.data)["strong"] === false, "E2E_RECOVERY_SESSION_IS_STRONG");
  const pathname = await browser.evaluate("window.location.pathname");
  ensure(pathname === "/security", "E2E_RECOVERY_SETTINGS_REDIRECT_MISSING");
}

async function totpLogin(browser: BrowserSession, login: Login, uri: string): Promise<void> {
  await browser.login(login.origin, login.account.email, login.account.password);
  await browser.commands(["wait", 'input[name="totp"]']);
  const passwordOnly = await apiStatus(browser, "/api/profile");
  ensure(passwordOnly === httpStatus.unauthorized, "E2E_PASSWORD_BYPASSES_TOTP");
  await browser.commands(["fill", 'input[name="totp"]', totp(uri)]);
  await browser.submitAuthentication("/api/auth/two-factor/verify-totp", [
    button("確認コードでログイン"),
  ]);
  await browser.commands(["wait", 'textarea[name="profile"]']);
  const session = await apiData(browser, "/api/session");
  ensure(session["strong"] === true, "E2E_TOTP_LOGIN_NOT_STRONG");
}

async function forgedAdminCookie(browser: BrowserSession): Promise<string> {
  const [result] = await browser.commands(["cookies"]);
  const cookies = result?.["cookies"];
  ensure(Array.isArray(cookies), "E2E_SESSION_COOKIES_MISSING");
  return cookies
    .map((entry: unknown) => object(entry))
    .filter((cookie) => string(cookie["name"]).startsWith("template-user"))
    .map((cookie) => {
      const name = string(cookie["name"]).replace("template-user", "template-admin");
      return `${name}=${string(cookie["value"])}`;
    })
    .join("; ");
}

async function cookieAudienceDenied(
  browser: BrowserSession,
  credentials: BasicCredentials,
): Promise<void> {
  const forged = await forgedAdminCookie(browser);
  ensure(forged.length > 0, "E2E_USER_SESSION_COOKIE_MISSING");
  const basic = Buffer.from(`${credentials.basicUser}:${credentials.basicPassword}`).toString(
    "base64",
  );
  const response = await fetch(`${credentials.adminOrigin}/api/users`, {
    headers: { authorization: `Basic ${basic}`, cookie: forged },
    signal: AbortSignal.timeout(requestTimeout.short),
  });
  ensure(deniedStatuses.has(response.status), "E2E_USER_COOKIE_ACCEPTED_BY_ADMIN");
}

async function waitForClearedProfile(browser: BrowserSession): Promise<void> {
  await poll({
    accept: (profile) => profile === "",
    code: "E2E_PROFILE_CLEAR_FAILED",
    read: async () => {
      const data = await apiData(browser, "/api/profile");
      return data["profile"];
    },
  });
}

export {
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
};
export type { Enrollment, Login };
