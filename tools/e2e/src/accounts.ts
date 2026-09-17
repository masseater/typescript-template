import { enabledButton } from "./browser.ts";
import type { Browser } from "./browser.ts";
import { verifyEmail } from "./mail.ts";
import type { Stack } from "./stack.ts";
import { ensure, object, string } from "./support.ts";
import { totp } from "./totp.ts";

export type Account = ReturnType<Stack["account"]>;
export const button = (name: string) => [
  "find",
  "role",
  "button",
  "click",
  "--name",
  name,
  "--exact",
];

export async function register(stack: Stack, browser: Browser, account: Account) {
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
  const unverified = await browser.api("/api/auth/sign-in/email", "POST", {
    email: account.email,
    password: account.password,
  });
  ensure(unverified.status === 403, "E2E_UNVERIFIED_EMAIL_LOGIN_ALLOWED");
  await verifyEmail(browser, account.email, stack.userOrigin, stack.messages);
  await browser.login(stack.userOrigin, account.email, account.password);
  await browser.commands(["wait", 'textarea[name="profile"]']);
  const response = await browser.api("/api/session");
  ensure(response.status === 200, "E2E_VERIFIED_LOGIN_FAILED");
  return string(object(object(response.data)["user"])["id"]);
}

export async function enrollTotp(browser: Browser, origin: string, password: string) {
  await browser.open(origin, "/security");
  await browser.commands(
    ["wait", 'input[name="password"]'],
    enabledButton("認証アプリの登録を開始"),
    ["fill", 'input[name="password"]', password],
    button("認証アプリの登録を開始"),
    ["wait", "#totp-uri"],
  );
  const uri = string(await browser.evaluate('document.querySelector("#totp-uri").value'));
  const codes = await browser.evaluate(
    'Array.from(document.querySelectorAll("[aria-label=バックアップコード] code"), node => node.textContent)',
  );
  ensure(Array.isArray(codes) && codes.length >= 2, "E2E_BACKUP_CODES_MISSING");
  const backupCodes = codes.map((code: unknown) => string(code));
  await browser.commands(
    ["check", 'input[type="checkbox"]'],
    ["fill", 'input[name="totp"]', totp(uri)],
    button("確認して認証アプリを有効化"),
    ["wait", 'textarea[name="profile"]'],
  );
  const session = await browser.api("/api/session");
  ensure(object(session.data)["strong"] === true, "E2E_TOTP_ENROLLMENT_NOT_STRONG");
  return { uri, backupCodes };
}
