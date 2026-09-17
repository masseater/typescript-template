import { expect, it } from "@effect/vitest";
import { randomUUID } from "node:crypto";
import { Effect } from "effect";
import { enabledButton } from "./browser.ts";
import type { Browser } from "./browser.ts";
import { createStack } from "./stack.ts";
import type { Stack } from "./stack.ts";
import { ensure, fail, fetchResponse, field, object, poll, staged, string } from "./support.ts";
import { verifyEmail } from "./mail.ts";
import { totp } from "./totp.ts";
import { verifyCorrelation, verifyBrowserSignals, verifyJourneyTelemetry } from "./telemetry.ts";
import { verifyDistribution } from "./distribution.ts";

type Account = ReturnType<Stack["account"]>;
const button = (name: string) => ["find", "role", "button", "click", "--name", name, "--exact"];

const register = Effect.fn("register")(function* (
  stack: Stack,
  browser: Browser,
  account: Account,
) {
  yield* browser.open(stack.userOrigin, "/signup");
  yield* browser.commands(
    ["wait", 'input[name="name"]'],
    enabledButton("登録して確認メールを送信"),
    ["fill", 'input[name="name"]', account.name],
    ["fill", 'input[name="email"]', account.email],
    ["fill", 'input[name="password"]', account.password],
    button("登録して確認メールを送信"),
  );
  yield* browser.waitText("確認メールを送信しました。");
  const unverified = yield* browser.api("/api/auth/sign-in/email", "POST", {
    email: account.email,
    password: account.password,
  });
  yield* ensure(unverified.status === 403, "E2E_UNVERIFIED_EMAIL_LOGIN_ALLOWED");
  yield* verifyEmail(browser, account.email, stack.userOrigin, stack.messages);
  yield* browser.login(stack.userOrigin, account.email, account.password);
  yield* browser.commands(["wait", 'textarea[name="profile"]']);
  const response = yield* browser.api("/api/session");
  yield* ensure(response.status === 200, "E2E_VERIFIED_LOGIN_FAILED");
  return yield* string(yield* field(response.data, "user", "id"));
});

const signOut = Effect.fn("signOut")(function* (browser: Browser) {
  yield* browser.commands(button("ログアウト"), ["wait", 'input[name="email"]']);
});

const enrollTotp = Effect.fn("enrollTotp")(function* (
  browser: Browser,
  origin: string,
  password: string,
) {
  yield* browser.open(origin, "/security");
  yield* browser.commands(
    ["wait", 'input[name="password"]'],
    enabledButton("認証アプリの登録を開始"),
    ["fill", 'input[name="password"]', password],
    button("認証アプリの登録を開始"),
    ["wait", "#totp-uri"],
  );
  const uri = yield* string(yield* browser.evaluate('document.querySelector("#totp-uri").value'));
  const codes = yield* browser.evaluate(
    'Array.from(document.querySelectorAll("[aria-label=バックアップコード] code"), node => node.textContent)',
  );
  yield* ensure(Array.isArray(codes) && codes.length >= 2, "E2E_BACKUP_CODES_MISSING");
  const backupCodes = yield* Effect.forEach(Array.isArray(codes) ? codes : [], (code: unknown) =>
    string(code),
  );
  yield* browser.commands(
    ["check", 'input[type="checkbox"]'],
    ["fill", 'input[name="totp"]', yield* totp(uri)],
    button("確認して認証アプリを有効化"),
    ["wait", 'textarea[name="profile"]'],
  );
  const session = yield* browser.api("/api/session");
  yield* ensure((yield* object(session.data))["strong"] === true, "E2E_TOTP_ENROLLMENT_NOT_STRONG");
  return { uri, backupCodes };
});

const submitBackupCode = Effect.fn("submitBackupCode")(function* (
  browser: Browser,
  origin: string,
  account: Account,
  code: string,
) {
  yield* browser.login(origin, account.email, account.password);
  yield* browser.commands(["wait", 'input[name="totp"]'], button("バックアップコードを使う"), [
    "fill",
    'input[name="backup-code"]',
    code,
  ]);
  yield* browser.submitAuthentication("/api/auth/two-factor/verify-backup-code", [
    button("バックアップコードでログイン"),
  ]);
});

const verifyRecoverySession = Effect.fn("verifyRecoverySession")(function* (browser: Browser) {
  yield* browser.waitText("バックアップコードでログインしました。");
  const response = yield* browser.api("/api/session");
  yield* ensure(response.status === 200, "E2E_RECOVERY_SESSION_MISSING");
  yield* ensure(
    (yield* object(response.data))["strong"] === false,
    "E2E_RECOVERY_SESSION_IS_STRONG",
  );
  yield* ensure(
    (yield* browser.evaluate("window.location.pathname")) === "/security",
    "E2E_RECOVERY_SETTINGS_REDIRECT_MISSING",
  );
});

const totpLogin = Effect.fn("totpLogin")(function* (
  browser: Browser,
  origin: string,
  account: Account,
  uri: string,
) {
  yield* browser.login(origin, account.email, account.password);
  yield* browser.commands(["wait", 'input[name="totp"]']);
  yield* ensure((yield* browser.api("/api/profile")).status === 401, "E2E_PASSWORD_BYPASSES_TOTP");
  yield* browser.commands(["fill", 'input[name="totp"]', yield* totp(uri)]);
  yield* browser.submitAuthentication("/api/auth/two-factor/verify-totp", [
    button("確認コードでログイン"),
  ]);
  yield* browser.commands(["wait", 'textarea[name="profile"]']);
  yield* ensure(
    (yield* object((yield* browser.api("/api/session")).data))["strong"] === true,
    "E2E_TOTP_LOGIN_NOT_STRONG",
  );
});

const cookieAudienceDenied = Effect.fn("cookieAudienceDenied")(function* (
  browser: Browser,
  stack: Stack,
) {
  const results = yield* browser.commands(["cookies"]);
  const cookies = results[0]?.["cookies"];
  yield* ensure(Array.isArray(cookies), "E2E_SESSION_COOKIES_MISSING");
  const forged: string[] = [];
  for (const entry of Array.isArray(cookies) ? cookies : []) {
    const cookie = yield* object(entry);
    const name = yield* string(cookie["name"]);
    if (name.startsWith("template-user"))
      forged.push(
        `${name.replace("template-user", "template-admin")}=${yield* string(cookie["value"])}`,
      );
  }
  const header = forged.join("; ");
  yield* ensure(header.length > 0, "E2E_USER_SESSION_COOKIE_MISSING");
  const response = yield* fetchResponse(`${stack.adminOrigin}/api/users`, {
    headers: {
      cookie: header,
      authorization: `Basic ${Buffer.from(`${stack.basicUser}:${stack.basicPassword}`).toString("base64")}`,
    },
    timeout: 5000,
  });
  yield* ensure([401, 403].includes(response.status), "E2E_USER_COOKIE_ACCEPTED_BY_ADMIN");
});

it.live(
  "isolated real Workers: registration, verified email, authorization, MFA, admin lifecycle and correlated telemetry",
  () => {
    let stage = "distribution";
    return Effect.gen(function* () {
      const stack = yield* createStack();
      yield* Effect.gen(function* () {
        const started = Date.now();
        yield* verifyDistribution(stack.userOrigin, stack.adminOrigin);
        const anonymous = stack.browser("anonymous");
        yield* anonymous.open(stack.userOrigin, "/login");
        yield* ensure(
          (yield* anonymous.api("/api/profile")).status === 401,
          "E2E_ANONYMOUS_PROFILE_ALLOWED",
        );

        stage = "registration";
        const owner = stack.account("owner");
        const alice = stack.account("alice");
        const bob = stack.account("bob");
        const ownerUser = stack.browser("owner-user");
        const aliceBrowser = stack.browser("alice");
        const bobBrowser = stack.browser("bob");
        const ownerId = yield* register(stack, ownerUser, owner);
        const aliceId = yield* register(stack, aliceBrowser, alice);
        const bobId = yield* register(stack, bobBrowser, bob);

        stage = "profile-isolation";
        const profile = `自己紹介 日本語 العربية 🌱 ${randomUUID()}`;
        yield* aliceBrowser.commands(
          ["fill", 'input[name="name"]', "E2E Alice"],
          ["fill", 'textarea[name="profile"]', profile],
          button("保存"),
        );
        yield* aliceBrowser.waitText("プロフィールを保存しました。");
        yield* aliceBrowser.open(stack.userOrigin, "/");
        yield* aliceBrowser.commands(["wait", 'textarea[name="profile"]']);
        yield* ensure(
          (yield* aliceBrowser.evaluate(
            'document.querySelector("textarea[name=profile]").value',
          )) === profile,
          "E2E_PROFILE_NOT_PERSISTED",
        );
        yield* ensure(
          (yield* object(
            (yield* bobBrowser.api(`/api/profile?id=${encodeURIComponent(aliceId)}`)).data,
          ))["id"] === bobId,
          "E2E_PROFILE_IDOR_READ",
        );
        yield* ensure(
          (yield* bobBrowser.api("/api/profile", "PATCH", {
            id: aliceId,
            name: "unauthorized",
            profile: "unauthorized",
          })).status === 400,
          "E2E_PROFILE_IDOR_WRITE",
        );
        yield* ensure(
          (yield* object((yield* aliceBrowser.api("/api/profile")).data))["profile"] === profile,
          "E2E_OTHER_USER_CHANGED_PROFILE",
        );
        yield* aliceBrowser.commands(
          ["fill", 'textarea[name="profile"]', "x"],
          ["press", "Backspace"],
          button("保存"),
        );
        yield* poll(
          Effect.flatMap(aliceBrowser.api("/api/profile"), (result) =>
            Effect.map(object(result.data), (data) => data["profile"]),
          ),
          (value) => value === "",
          "E2E_PROFILE_CLEAR_FAILED",
        );
        yield* cookieAudienceDenied(aliceBrowser, stack);

        stage = "totp";
        const originalEnrollment = yield* enrollTotp(
          aliceBrowser,
          stack.userOrigin,
          alice.password,
        );
        yield* signOut(aliceBrowser);
        yield* totpLogin(aliceBrowser, stack.userOrigin, alice, originalEnrollment.uri);

        stage = "backup-code-recovery";
        const usedCode = yield* string(originalEnrollment.backupCodes[0]);
        yield* signOut(aliceBrowser);
        yield* submitBackupCode(aliceBrowser, stack.userOrigin, alice, usedCode);
        yield* verifyRecoverySession(aliceBrowser);
        yield* signOut(aliceBrowser);
        yield* submitBackupCode(aliceBrowser, stack.userOrigin, alice, usedCode);
        yield* aliceBrowser.commands(["wait", '[role="alert"]']);
        yield* ensure(
          (yield* aliceBrowser.api("/api/session")).status === 401,
          "E2E_BACKUP_CODE_REUSED",
        );
        yield* aliceBrowser.commands(button("認証アプリのコードを使う"), [
          "fill",
          'input[name="totp"]',
          yield* totp(originalEnrollment.uri),
        ]);
        yield* aliceBrowser.submitAuthentication("/api/auth/two-factor/verify-totp", [
          button("確認コードでログイン"),
        ]);
        yield* aliceBrowser.commands(["wait", 'textarea[name="profile"]']);
        yield* signOut(aliceBrowser);
        yield* submitBackupCode(
          aliceBrowser,
          stack.userOrigin,
          alice,
          yield* string(originalEnrollment.backupCodes[1]),
        );
        yield* verifyRecoverySession(aliceBrowser);
        yield* aliceBrowser.commands(
          enabledButton("認証アプリを解除"),
          ["fill", 'input[name="password"]', alice.password],
          button("認証アプリを解除"),
          ["wait", "--url", "**/login?recovery=setup"],
          ["wait", 'input[name="email"]'],
          enabledButton("ログイン"),
        );
        yield* aliceBrowser.fillStable([
          ['input[name="email"]', alice.email],
          ['input[name="password"]', alice.password],
        ]);
        yield* aliceBrowser.submitAuthentication("/api/auth/sign-in/email", [button("ログイン")]);
        yield* aliceBrowser.waitText("新しい認証アプリを登録してください。");
        const restoredEnrollment = yield* enrollTotp(
          aliceBrowser,
          stack.userOrigin,
          alice.password,
        );
        const { uri } = restoredEnrollment;
        yield* signOut(aliceBrowser);
        yield* totpLogin(aliceBrowser, stack.userOrigin, alice, uri);

        stage = "admin-weak-auth";
        yield* stack.bootstrap(owner.email);
        const admin = stack.browser("admin");
        yield* admin.commands(["set", "credentials", stack.basicUser, stack.basicPassword]);
        yield* admin.login(stack.adminOrigin, owner.email, owner.password);
        yield* admin.waitText("追加認証を完了してください。");
        yield* ensure(
          (yield* admin.api("/api/users")).status === 403,
          "E2E_WEAK_ADMIN_SESSION_ACCEPTED",
        );
        yield* ensure(
          (yield* admin.api("/api/auth/sign-up/email", "POST", {
            name: "Forbidden",
            email: "forbidden@example.test",
            password: owner.password,
          })).status >= 400,
          "E2E_PUBLIC_ADMIN_SIGNUP_ALLOWED",
        );

        stage = "passkey";
        yield* admin.open(stack.adminOrigin, "/security");
        yield* admin.commands(
          ["wait", 'input[name="passkey-name"]'],
          enabledButton("パスキーを登録"),
        );
        const cdp = yield* Effect.acquireRelease(admin.connectCdp(), (connected) =>
          Effect.sync(() => connected.close()),
        );
        const authenticatorId = yield* cdp.authenticator();
        yield* admin.commands(
          ["fill", 'input[name="passkey-name"]', "E2E hardware-backed protocol"],
          button("パスキーを登録"),
        );
        yield* admin.waitText("パスキーを登録しました。");
        yield* ensure(
          (yield* admin.api("/api/users")).status === 403,
          "E2E_ENROLLMENT_SILENTLY_ELEVATES_SESSION",
        );
        const before = yield* cdp.send("WebAuthn.getCredentials", { authenticatorId });
        const credentials = before["credentials"];
        yield* ensure(
          Array.isArray(credentials) && credentials.length === 1,
          "E2E_PASSKEY_CREDENTIAL_NOT_CREATED",
        );
        const credential = yield* object(Array.isArray(credentials) ? credentials[0] : undefined);
        yield* ensure(
          typeof credential["privateKey"] === "string",
          "E2E_PASSKEY_PRIVATE_KEY_NOT_GENERATED",
        );
        const signCount = credential["signCount"];
        if (typeof signCount !== "number") return yield* fail("E2E_PASSKEY_SIGN_COUNTER_MISSING");
        yield* admin.open(stack.adminOrigin, "/");
        yield* signOut(admin);
        yield* admin.commands(button("パスキーでログイン"), ["wait", "tbody tr"]);
        const after = (yield* cdp.send("WebAuthn.getCredentials", { authenticatorId }))[
          "credentials"
        ];
        const renewed = Array.isArray(after) ? yield* object(after[0]) : undefined;
        yield* ensure(
          renewed !== undefined &&
            typeof renewed["signCount"] === "number" &&
            renewed["signCount"] > signCount,
          "E2E_PASSKEY_SIGNATURE_NOT_PRODUCED",
        );
        yield* ensure(
          (yield* admin.api("/api/users")).status === 200,
          "E2E_PASSKEY_ADMIN_LOGIN_FAILED",
        );

        stage = "admin-lifecycle";
        yield* admin.waitText(alice.email);
        yield* admin.commands(button(`${alice.email} を管理者に変更`), ["dialog", "accept"]);
        yield* admin.waitText("権限を変更しました。既存セッションは失効しました。");
        yield* ensure(
          (yield* aliceBrowser.api("/api/profile")).status === 401,
          "E2E_ROLE_CHANGE_DID_NOT_REVOKE_SESSION",
        );
        stage = "admin-backup-code-recovery";
        const recoveringAdmin = stack.browser("recovering-admin");
        yield* recoveringAdmin.commands([
          "set",
          "credentials",
          stack.basicUser,
          stack.basicPassword,
        ]);
        yield* submitBackupCode(
          recoveringAdmin,
          stack.adminOrigin,
          alice,
          yield* string(restoredEnrollment.backupCodes[0]),
        );
        yield* verifyRecoverySession(recoveringAdmin);
        yield* recoveringAdmin.waitText("復旧コードでは管理者操作はできません。");
        yield* ensure(
          (yield* recoveringAdmin.api("/api/users")).status === 403,
          "E2E_RECOVERY_ADMIN_READ_ALLOWED",
        );
        yield* ensure(
          (yield* recoveringAdmin.api("/api/users", "PATCH", { id: bobId, role: "admin" }))
            .status === 403,
          "E2E_RECOVERY_ADMIN_ROLE_CHANGE_ALLOWED",
        );
        yield* ensure(
          (yield* recoveringAdmin.api("/api/users", "DELETE", { id: bobId })).status === 403,
          "E2E_RECOVERY_ADMIN_DELETE_ALLOWED",
        );
        yield* signOut(recoveringAdmin);
        yield* recoveringAdmin.login(stack.adminOrigin, alice.email, alice.password);
        yield* recoveringAdmin.commands(
          ["wait", 'input[name="totp"]'],
          ["fill", 'input[name="totp"]', yield* totp(uri)],
        );
        yield* recoveringAdmin.submitAuthentication("/api/auth/two-factor/verify-totp", [
          button("確認コードでログイン"),
        ]);
        yield* recoveringAdmin.commands(["wait", "tbody tr"]);
        yield* ensure(
          (yield* recoveringAdmin.api("/api/users")).status === 200,
          "E2E_RECOVERY_ADMIN_STRONG_RELOGIN_FAILED",
        );
        stage = "admin-lifecycle";
        yield* ensure(
          (yield* admin.api("/api/users", "PATCH", { id: aliceId, role: "user" })).status === 200,
          "E2E_ADMIN_DEMOTION_FAILED",
        );
        yield* ensure(
          (yield* admin.api("/api/users", "PATCH", { id: ownerId, role: "user" })).status === 409,
          "E2E_LAST_ADMIN_DEMOTION_ALLOWED",
        );
        yield* ensure(
          (yield* admin.api("/api/users", "DELETE", { id: ownerId })).status === 409,
          "E2E_LAST_ADMIN_DELETION_ALLOWED",
        );
        yield* admin.commands(button(`${bob.email} を削除`), ["dialog", "accept"]);
        yield* admin.waitText("ユーザーを削除しました。");
        yield* ensure(
          (yield* bobBrowser.api("/api/profile")).status === 401,
          "E2E_DELETED_USER_SESSION_VALID",
        );
        const list = (yield* object((yield* admin.api("/api/users")).data))["users"];
        let listed = !Array.isArray(list);
        for (const user of Array.isArray(list) ? list : [])
          if ((yield* object(user))["id"] === bobId) {
            listed = true;
            break;
          }
        yield* ensure(!listed, "E2E_DELETED_USER_STILL_LISTED");
        yield* ensure(
          (yield* bobBrowser.api("/api/auth/sign-in/email", "POST", {
            email: bob.email,
            password: bob.password,
          })).status >= 400,
          "E2E_DELETED_USER_CAN_LOGIN",
        );

        stage = "real-telemetry";
        yield* totpLogin(aliceBrowser, stack.userOrigin, alice, uri);
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
        yield* verifyCorrelation(
          stack.userOrigin,
          yield* aliceBrowser.api("/api/profile"),
          "user",
          forbidden,
        );
        yield* verifyCorrelation(
          stack.adminOrigin,
          yield* admin.api("/api/users"),
          "admin",
          forbidden,
        );
        yield* verifyJourneyTelemetry(
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
        yield* aliceBrowser.evaluate(
          'setTimeout(() => { throw new Error("E2E browser exception privacy canary"); }, 0); true',
        );
        const tabs = (yield* aliceBrowser.commands(["tab", "list"]))[0]?.["tabs"];
        yield* ensure(Array.isArray(tabs), "E2E_BROWSER_TABS_MISSING");
        let active: unknown;
        for (const entry of Array.isArray(tabs) ? tabs : [])
          if ((yield* object(entry))["active"] === true) {
            active = entry;
            break;
          }
        const applicationTab = yield* string((yield* object(active))["tabId"]);
        yield* aliceBrowser.commands(["tab", "new", "about:blank"], ["tab", applicationTab]);
        yield* verifyBrowserSignals(stack.userOrigin, "user", started);

        stage = "worker-isolation";
        yield* stack.stopUser();
        expect((yield* admin.api("/api/users")).status).toBe(200);
        yield* admin.open(stack.adminOrigin, "/");
        yield* admin.commands(["wait", "tbody tr"]);
      }).pipe(staged(() => stage));
    });
  },
);
