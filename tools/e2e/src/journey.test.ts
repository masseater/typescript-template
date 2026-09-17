import { expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { enabledButton } from "./browser.ts";
import type { Browser, Cdp } from "./browser.ts";
import { createStack } from "./stack.ts";
import type { Stack } from "./stack.ts";
import { ensure, object, poll, string, safeFailure } from "./support.ts";
import { verifyEmail } from "./mail.ts";
import { totp } from "./totp.ts";
import { verifyCorrelation, verifyBrowserSignals, verifyJourneyTelemetry } from "./telemetry.ts";
import { verifyDistribution } from "./distribution.ts";

type Account = ReturnType<Stack["account"]>;
const button = (name: string) => ["find", "role", "button", "click", "--name", name, "--exact"];

async function register(stack: Stack, browser: Browser, account: Account) {
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

async function signOut(browser: Browser) {
  await browser.commands(button("ログアウト"), ["wait", 'input[name="email"]']);
}

async function enrollTotp(browser: Browser, origin: string, password: string) {
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

async function submitBackupCode(browser: Browser, origin: string, account: Account, code: string) {
  await browser.login(origin, account.email, account.password);
  await browser.commands(["wait", 'input[name="totp"]'], button("バックアップコードを使う"), [
    "fill",
    'input[name="backup-code"]',
    code,
  ]);
  await browser.submitAuthentication("/api/auth/two-factor/verify-backup-code", [
    button("バックアップコードでログイン"),
  ]);
}

async function verifyRecoverySession(browser: Browser) {
  await browser.waitText("バックアップコードでログインしました。");
  const response = await browser.api("/api/session");
  ensure(response.status === 200, "E2E_RECOVERY_SESSION_MISSING");
  ensure(object(response.data)["strong"] === false, "E2E_RECOVERY_SESSION_IS_STRONG");
  ensure(
    (await browser.evaluate("window.location.pathname")) === "/security",
    "E2E_RECOVERY_SETTINGS_REDIRECT_MISSING",
  );
}

async function totpLogin(browser: Browser, origin: string, account: Account, uri: string) {
  await browser.login(origin, account.email, account.password);
  await browser.commands(["wait", 'input[name="totp"]']);
  ensure((await browser.api("/api/profile")).status === 401, "E2E_PASSWORD_BYPASSES_TOTP");
  await browser.commands(["fill", 'input[name="totp"]', totp(uri)]);
  await browser.submitAuthentication("/api/auth/two-factor/verify-totp", [
    button("確認コードでログイン"),
  ]);
  await browser.commands(["wait", 'textarea[name="profile"]']);
  ensure(
    object((await browser.api("/api/session")).data)["strong"] === true,
    "E2E_TOTP_LOGIN_NOT_STRONG",
  );
}

async function cookieAudienceDenied(browser: Browser, stack: Stack) {
  const results = await browser.commands(["cookies"]);
  const cookies = results[0]?.["cookies"];
  ensure(Array.isArray(cookies), "E2E_SESSION_COOKIES_MISSING");
  const forged = cookies
    .map((entry: unknown) => object(entry))
    .filter((cookie) => string(cookie["name"]).startsWith("template-user"))
    .map(
      (cookie) =>
        `${string(cookie["name"]).replace("template-user", "template-admin")}=${string(cookie["value"])}`,
    )
    .join("; ");
  ensure(forged.length > 0, "E2E_USER_SESSION_COOKIE_MISSING");
  const response = await fetch(`${stack.adminOrigin}/api/users`, {
    headers: {
      cookie: forged,
      authorization: `Basic ${Buffer.from(`${stack.basicUser}:${stack.basicPassword}`).toString("base64")}`,
    },
    signal: AbortSignal.timeout(5000),
  });
  ensure([401, 403].includes(response.status), "E2E_USER_COOKIE_ACCEPTED_BY_ADMIN");
}

test("isolated real Workers: registration, verified email, authorization, MFA, admin lifecycle and correlated telemetry", async () => {
  const stack = await createStack();
  let cdp: Cdp | undefined;
  let stage = "distribution";
  try {
    const started = Date.now();
    await verifyDistribution(stack.userOrigin, stack.adminOrigin);
    const anonymous = stack.browser("anonymous");
    await anonymous.open(stack.userOrigin, "/login");
    ensure((await anonymous.api("/api/profile")).status === 401, "E2E_ANONYMOUS_PROFILE_ALLOWED");

    stage = "registration";
    const owner = stack.account("owner");
    const alice = stack.account("alice");
    const bob = stack.account("bob");
    const ownerUser = stack.browser("owner-user");
    const aliceBrowser = stack.browser("alice");
    const bobBrowser = stack.browser("bob");
    const ownerId = await register(stack, ownerUser, owner);
    const aliceId = await register(stack, aliceBrowser, alice);
    const bobId = await register(stack, bobBrowser, bob);

    stage = "profile-isolation";
    const profile = `自己紹介 日本語 العربية 🌱 ${randomUUID()}`;
    await aliceBrowser.commands(
      ["fill", 'input[name="name"]', "E2E Alice"],
      ["fill", 'textarea[name="profile"]', profile],
      button("保存"),
    );
    await aliceBrowser.waitText("プロフィールを保存しました。");
    await aliceBrowser.open(stack.userOrigin, "/");
    await aliceBrowser.commands(["wait", 'textarea[name="profile"]']);
    ensure(
      (await aliceBrowser.evaluate('document.querySelector("textarea[name=profile]").value')) ===
        profile,
      "E2E_PROFILE_NOT_PERSISTED",
    );
    ensure(
      object((await bobBrowser.api(`/api/profile?id=${encodeURIComponent(aliceId)}`)).data)[
        "id"
      ] === bobId,
      "E2E_PROFILE_IDOR_READ",
    );
    ensure(
      (
        await bobBrowser.api("/api/profile", "PATCH", {
          id: aliceId,
          name: "unauthorized",
          profile: "unauthorized",
        })
      ).status === 400,
      "E2E_PROFILE_IDOR_WRITE",
    );
    ensure(
      object((await aliceBrowser.api("/api/profile")).data)["profile"] === profile,
      "E2E_OTHER_USER_CHANGED_PROFILE",
    );
    await aliceBrowser.commands(
      ["fill", 'textarea[name="profile"]', "x"],
      ["press", "Backspace"],
      button("保存"),
    );
    await poll(
      () => aliceBrowser.api("/api/profile"),
      (result) => object(result.data)["profile"] === "",
      "E2E_PROFILE_CLEAR_FAILED",
    );
    await cookieAudienceDenied(aliceBrowser, stack);

    stage = "totp";
    const originalEnrollment = await enrollTotp(aliceBrowser, stack.userOrigin, alice.password);
    await signOut(aliceBrowser);
    await totpLogin(aliceBrowser, stack.userOrigin, alice, originalEnrollment.uri);

    stage = "backup-code-recovery";
    const usedCode = string(originalEnrollment.backupCodes[0]);
    await signOut(aliceBrowser);
    await submitBackupCode(aliceBrowser, stack.userOrigin, alice, usedCode);
    await verifyRecoverySession(aliceBrowser);
    await signOut(aliceBrowser);
    await submitBackupCode(aliceBrowser, stack.userOrigin, alice, usedCode);
    await aliceBrowser.commands(["wait", '[role="alert"]']);
    ensure((await aliceBrowser.api("/api/session")).status === 401, "E2E_BACKUP_CODE_REUSED");
    await aliceBrowser.commands(button("認証アプリのコードを使う"), [
      "fill",
      'input[name="totp"]',
      totp(originalEnrollment.uri),
    ]);
    await aliceBrowser.submitAuthentication("/api/auth/two-factor/verify-totp", [
      button("確認コードでログイン"),
    ]);
    await aliceBrowser.commands(["wait", 'textarea[name="profile"]']);
    await signOut(aliceBrowser);
    await submitBackupCode(
      aliceBrowser,
      stack.userOrigin,
      alice,
      string(originalEnrollment.backupCodes[1]),
    );
    await verifyRecoverySession(aliceBrowser);
    await aliceBrowser.commands(
      enabledButton("認証アプリを解除"),
      ["fill", 'input[name="password"]', alice.password],
      button("認証アプリを解除"),
      ["wait", "--url", "**/login?recovery=setup"],
      ["wait", 'input[name="email"]'],
      enabledButton("ログイン"),
    );
    await aliceBrowser.fillStable([
      ['input[name="email"]', alice.email],
      ['input[name="password"]', alice.password],
    ]);
    await aliceBrowser.submitAuthentication("/api/auth/sign-in/email", [button("ログイン")]);
    await aliceBrowser.waitText("新しい認証アプリを登録してください。");
    const restoredEnrollment = await enrollTotp(aliceBrowser, stack.userOrigin, alice.password);
    const { uri } = restoredEnrollment;
    await signOut(aliceBrowser);
    await totpLogin(aliceBrowser, stack.userOrigin, alice, uri);

    stage = "admin-weak-auth";
    await stack.bootstrap(owner.email);
    const admin = stack.browser("admin");
    await admin.commands(["set", "credentials", stack.basicUser, stack.basicPassword]);
    await admin.login(stack.adminOrigin, owner.email, owner.password);
    await admin.waitText("追加認証を完了してください。");
    ensure((await admin.api("/api/users")).status === 403, "E2E_WEAK_ADMIN_SESSION_ACCEPTED");
    ensure(
      (
        await admin.api("/api/auth/sign-up/email", "POST", {
          name: "Forbidden",
          email: "forbidden@example.test",
          password: owner.password,
        })
      ).status >= 400,
      "E2E_PUBLIC_ADMIN_SIGNUP_ALLOWED",
    );

    stage = "passkey";
    await admin.open(stack.adminOrigin, "/security");
    await admin.commands(["wait", 'input[name="passkey-name"]'], enabledButton("パスキーを登録"));
    cdp = await admin.connectCdp();
    const authenticatorId = await cdp.authenticator();
    await admin.commands(
      ["fill", 'input[name="passkey-name"]', "E2E hardware-backed protocol"],
      button("パスキーを登録"),
    );
    await admin.waitText("パスキーを登録しました。");
    ensure(
      (await admin.api("/api/users")).status === 403,
      "E2E_ENROLLMENT_SILENTLY_ELEVATES_SESSION",
    );
    const before = await cdp.send("WebAuthn.getCredentials", { authenticatorId });
    const credentials = before["credentials"];
    ensure(
      Array.isArray(credentials) && credentials.length === 1,
      "E2E_PASSKEY_CREDENTIAL_NOT_CREATED",
    );
    const credential = object(credentials[0]);
    ensure(typeof credential["privateKey"] === "string", "E2E_PASSKEY_PRIVATE_KEY_NOT_GENERATED");
    const signCount = credential["signCount"];
    ensure(typeof signCount === "number", "E2E_PASSKEY_SIGN_COUNTER_MISSING");
    await admin.open(stack.adminOrigin, "/");
    await signOut(admin);
    await admin.commands(button("パスキーでログイン"), ["wait", "tbody tr"]);
    const after = (await cdp.send("WebAuthn.getCredentials", { authenticatorId }))["credentials"];
    ensure(
      Array.isArray(after) &&
        typeof object(after[0])["signCount"] === "number" &&
        Number(object(after[0])["signCount"]) > signCount,
      "E2E_PASSKEY_SIGNATURE_NOT_PRODUCED",
    );
    ensure((await admin.api("/api/users")).status === 200, "E2E_PASSKEY_ADMIN_LOGIN_FAILED");

    stage = "admin-lifecycle";
    await admin.waitText(alice.email);
    await admin.commands(button(`${alice.email} を管理者に変更`), ["dialog", "accept"]);
    await admin.waitText("権限を変更しました。既存セッションは失効しました。");
    ensure(
      (await aliceBrowser.api("/api/profile")).status === 401,
      "E2E_ROLE_CHANGE_DID_NOT_REVOKE_SESSION",
    );
    stage = "admin-backup-code-recovery";
    const recoveringAdmin = stack.browser("recovering-admin");
    await recoveringAdmin.commands(["set", "credentials", stack.basicUser, stack.basicPassword]);
    await submitBackupCode(
      recoveringAdmin,
      stack.adminOrigin,
      alice,
      string(restoredEnrollment.backupCodes[0]),
    );
    await verifyRecoverySession(recoveringAdmin);
    await recoveringAdmin.waitText("復旧コードでは管理者操作はできません。");
    ensure(
      (await recoveringAdmin.api("/api/users")).status === 403,
      "E2E_RECOVERY_ADMIN_READ_ALLOWED",
    );
    ensure(
      (await recoveringAdmin.api("/api/users", "PATCH", { id: bobId, role: "admin" })).status ===
        403,
      "E2E_RECOVERY_ADMIN_ROLE_CHANGE_ALLOWED",
    );
    ensure(
      (await recoveringAdmin.api("/api/users", "DELETE", { id: bobId })).status === 403,
      "E2E_RECOVERY_ADMIN_DELETE_ALLOWED",
    );
    await signOut(recoveringAdmin);
    await recoveringAdmin.login(stack.adminOrigin, alice.email, alice.password);
    await recoveringAdmin.commands(
      ["wait", 'input[name="totp"]'],
      ["fill", 'input[name="totp"]', totp(uri)],
    );
    await recoveringAdmin.submitAuthentication("/api/auth/two-factor/verify-totp", [
      button("確認コードでログイン"),
    ]);
    await recoveringAdmin.commands(["wait", "tbody tr"]);
    ensure(
      (await recoveringAdmin.api("/api/users")).status === 200,
      "E2E_RECOVERY_ADMIN_STRONG_RELOGIN_FAILED",
    );
    stage = "admin-lifecycle";
    ensure(
      (await admin.api("/api/users", "PATCH", { id: aliceId, role: "user" })).status === 200,
      "E2E_ADMIN_DEMOTION_FAILED",
    );
    ensure(
      (await admin.api("/api/users", "PATCH", { id: ownerId, role: "user" })).status === 409,
      "E2E_LAST_ADMIN_DEMOTION_ALLOWED",
    );
    ensure(
      (await admin.api("/api/users", "DELETE", { id: ownerId })).status === 409,
      "E2E_LAST_ADMIN_DELETION_ALLOWED",
    );
    await admin.commands(button(`${bob.email} を削除`), ["dialog", "accept"]);
    await admin.waitText("ユーザーを削除しました。");
    ensure((await bobBrowser.api("/api/profile")).status === 401, "E2E_DELETED_USER_SESSION_VALID");
    const list = object((await admin.api("/api/users")).data)["users"];
    ensure(
      Array.isArray(list) && !list.some((user: unknown) => object(user)["id"] === bobId),
      "E2E_DELETED_USER_STILL_LISTED",
    );
    ensure(
      (
        await bobBrowser.api("/api/auth/sign-in/email", "POST", {
          email: bob.email,
          password: bob.password,
        })
      ).status >= 400,
      "E2E_DELETED_USER_CAN_LOGIN",
    );

    stage = "real-telemetry";
    await totpLogin(aliceBrowser, stack.userOrigin, alice, uri);
    const forbidden = [
      profile,
      owner.email,
      alice.email,
      bob.email,
      owner.password,
      alice.password,
      bob.password,
      stack.basicPassword,
      uri,
      originalEnrollment.uri,
      ...originalEnrollment.backupCodes,
      ...restoredEnrollment.backupCodes,
    ];
    await verifyCorrelation(
      stack.userOrigin,
      await aliceBrowser.api("/api/profile"),
      "user",
      forbidden,
    );
    await verifyCorrelation(stack.adminOrigin, await admin.api("/api/users"), "admin", forbidden);
    await verifyJourneyTelemetry(
      [
        { browser: anonymous, service: "user", origin: stack.userOrigin },
        { browser: ownerUser, service: "user", origin: stack.userOrigin },
        { browser: aliceBrowser, service: "user", origin: stack.userOrigin },
        { browser: bobBrowser, service: "user", origin: stack.userOrigin },
        { browser: admin, service: "admin", origin: stack.adminOrigin },
        { browser: recoveringAdmin, service: "admin", origin: stack.adminOrigin },
      ],
      forbidden,
      started,
    );
    await aliceBrowser.evaluate(
      'setTimeout(() => { throw new Error("E2E browser exception privacy canary"); }, 0); true',
    );
    const tabs = (await aliceBrowser.commands(["tab", "list"]))[0]?.["tabs"];
    ensure(Array.isArray(tabs), "E2E_BROWSER_TABS_MISSING");
    const applicationTab = string(
      object(tabs.find((entry: unknown) => object(entry)["active"] === true))["tabId"],
    );
    await aliceBrowser.commands(["tab", "new", "about:blank"], ["tab", applicationTab]);
    await verifyBrowserSignals(stack.userOrigin, "user", started);

    stage = "worker-isolation";
    await stack.stopUser();
    expect((await admin.api("/api/users")).status).toBe(200);
    await admin.open(stack.adminOrigin, "/");
    await admin.commands(["wait", "tbody tr"]);
  } catch (error) {
    throw safeFailure(error, stage);
  } finally {
    cdp?.close();
    await stack.cleanup();
  }
});
