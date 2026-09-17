import type { Stack } from "./stack.ts";
import { ensure } from "./support.ts";

export async function verifySharedRoutes(stack: Stack) {
  const adminBrowser = stack.browser("shared-admin");
  await adminBrowser.commands(["set", "credentials", stack.basicUser, stack.basicPassword]);
  const contracts = [
    {
      origin: stack.userOrigin,
      browser: stack.browser("shared-user"),
      headers: {},
      documentTitle: "ユーザーアプリ",
      home: "プロフィール",
      login: "ログイン",
      security: "認証設定",
      signUp: true,
    },
    {
      origin: stack.adminOrigin,
      browser: adminBrowser,
      headers: {
        authorization: `Basic ${Buffer.from(`${stack.basicUser}:${stack.basicPassword}`).toString("base64")}`,
      },
      documentTitle: "管理者アプリ",
      home: "ユーザー管理",
      login: "管理者ログイン",
      security: "管理者の認証設定",
      signUp: false,
    },
  ];
  for (const contract of contracts) {
    const { browser, origin } = contract;
    const rendered = await fetch(`${origin}/login`, {
      headers: contract.headers,
      signal: AbortSignal.timeout(10_000),
    });
    ensure(
      rendered.ok && (await rendered.text()).includes(`<title>${contract.documentTitle}</title>`),
      "E2E_SHARED_DOCUMENT_TITLE_MISMATCH",
    );
    await browser.open(origin, "/login");
    await browser.commands(["wait", 'input[name="email"]']);
    await browser.waitText(contract.login);
    ensure(
      JSON.stringify(
        await browser.evaluate(
          'Array.from(document.querySelectorAll("nav[aria-label=メイン] a"), (link) => [link.getAttribute("href"), link.textContent])',
        ),
      ) ===
        JSON.stringify([
          ["/", contract.home],
          ["/security", "認証設定"],
          ["/login", "ログイン"],
        ]),
      "E2E_SHARED_NAVIGATION_MISMATCH",
    );
    ensure(
      (await browser.evaluate('document.querySelector("main a[href=\\"/signup\\"]") !== null')) ===
        contract.signUp,
      "E2E_SHARED_SIGN_UP_LINK_MISMATCH",
    );
    ensure((await browser.api("/api/session")).status === 401, "E2E_SHARED_ANONYMOUS_SESSION");
    const authSession = await browser.api("/api/auth/get-session");
    ensure(
      authSession.status === 200 && authSession.data === null,
      "E2E_SHARED_AUTH_HANDLER_MISMATCH",
    );
    await browser.open(origin, "/security");
    await browser.waitText(contract.security);
    await browser.waitText("ログインしてください。");
  }
}
