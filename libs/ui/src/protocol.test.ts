import { describe, expect, it } from "vite-plus/test";
import { errorMessage, requirePasskeyUV, requireSuccess, sessionSchema } from "./protocol";
import { parse } from "valibot";

describe("パスキー応答の本人確認", () => {
  it("認証要求では既存の challenge を維持して本人確認を必須にする", () => {
    expect.hasAssertions();
    const response = { challenge: "challenge", userVerification: "preferred" };
    requirePasskeyUV(response, "/api/auth/passkey/generate-authenticate-options");
    expect(response).toStrictEqual({ challenge: "challenge", userVerification: "required" });
  });

  it("登録要求では認証器の指定を維持して本人確認を必須にする", () => {
    expect.hasAssertions();
    const response = {
      authenticatorSelection: { residentKey: "required", userVerification: "discouraged" },
    };
    requirePasskeyUV(response, "/api/auth/passkey/generate-register-options");
    expect(response.authenticatorSelection).toStrictEqual({
      residentKey: "required",
      userVerification: "required",
    });
  });

  it("登録要求に認証器の指定がなくても本人確認を必須にする", () => {
    expect.hasAssertions();
    const response = { challenge: "challenge" };
    requirePasskeyUV(response, "/api/auth/passkey/generate-register-options");
    expect(response).toStrictEqual({
      authenticatorSelection: { userVerification: "required" },
      challenge: "challenge",
    });
  });

  it("パスキー以外の応答は変更しない", () => {
    expect.hasAssertions();
    const response = { userVerification: "unchanged" };
    requirePasskeyUV(response, "/api/auth/get-session");
    expect(response).toStrictEqual({ userVerification: "unchanged" });
  });
});

describe("パスキー応答の形式検証", () => {
  it("パスキー設定の不正な応答を拒否する", () => {
    expect.hasAssertions();
    expect(() => {
      // oxlint-disable-next-line unicorn/no-null
      requirePasskeyUV(null, "/api/auth/passkey/generate-register-options");
    }).toThrow("パスキー設定の応答形式が不正です。");
    expect(() => {
      requirePasskeyUV(
        { authenticatorSelection: "invalid" },
        "/api/auth/passkey/generate-register-options",
      );
    }).toThrow("パスキー登録設定の応答形式が不正です。");
  });
});

describe("認証結果の検証", () => {
  it("認証失敗と結果の欠落を成功扱いにしない", () => {
    expect.hasAssertions();
    // oxlint-disable-next-line unicorn/no-null
    expect(() => requireSuccess({ data: null, error: { message: "SESSION_INVALID" } })).toThrow(
      "SESSION_INVALID",
    );
    // oxlint-disable-next-line unicorn/no-null
    expect(() => requireSuccess({ data: null, error: null })).toThrow("結果が返りませんでした");
    // oxlint-disable-next-line unicorn/no-null
    expect(() => requireSuccess({ data: undefined, error: null })).toThrow(
      "結果が返りませんでした",
    );
    // oxlint-disable-next-line unicorn/no-null
    expect(requireSuccess({ data: { status: true }, error: null })).toStrictEqual({
      status: true,
    });
  });

  it("セッションの強度とロールを応答から明示的に検証する", () => {
    expect.hasAssertions();
    const user = {
      email: "user@example.com",
      id: "user-id",
      name: "名前",
      role: "user",
      twoFactorEnabled: false,
    };
    expect(parse(sessionSchema, { strong: false, user })).toStrictEqual({ strong: false, user });
    expect(() => parse(sessionSchema, { user })).toThrow("Invalid key");
    expect(() => parse(sessionSchema, { strong: "true", user })).toThrow("Invalid type");
    expect(() => parse(sessionSchema, { strong: true, user: { ...user, role: "root" } })).toThrow(
      "Invalid type",
    );
  });

  it("失敗理由は HTML に変換せず文字列として扱う", () => {
    expect.hasAssertions();
    expect(errorMessage(new Error("<script>alert(1)</script>"))).toBe("<script>alert(1)</script>");
    expect(errorMessage("<script>alert(1)</script>")).toBe(
      "操作に失敗しました。もう一度お試しください。",
    );
  });
});
