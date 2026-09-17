import { expect, test } from "vite-plus/test";
import { SessionView } from "@template/runtime/contracts";
import { Schema } from "effect";
import { errorMessage, requireSuccess, requirePasskeyUV } from "./protocol";

test("認証要求では既存の challenge を維持して本人確認を必須にする", () => {
  const response = { challenge: "challenge", userVerification: "preferred" };
  requirePasskeyUV(response, "/api/auth/passkey/generate-authenticate-options");
  expect(response).toEqual({ challenge: "challenge", userVerification: "required" });
});

test("登録要求では認証器の指定を維持して本人確認を必須にする", () => {
  const response = {
    authenticatorSelection: { residentKey: "required", userVerification: "discouraged" },
  };
  requirePasskeyUV(response, "/api/auth/passkey/generate-register-options");
  expect(response.authenticatorSelection).toEqual({
    residentKey: "required",
    userVerification: "required",
  });
});

test("登録要求に認証器の指定がなくても本人確認を必須にする", () => {
  const response = { challenge: "challenge" };
  requirePasskeyUV(response, "/api/auth/passkey/generate-register-options");
  expect(response).toEqual({
    challenge: "challenge",
    authenticatorSelection: { userVerification: "required" },
  });
});

test("パスキー設定の不正な応答を拒否する", () => {
  expect(() => requirePasskeyUV(null, "/api/auth/passkey/generate-register-options")).toThrow(
    "パスキー設定の応答形式が不正です。",
  );
  expect(() =>
    requirePasskeyUV(
      { authenticatorSelection: "invalid" },
      "/api/auth/passkey/generate-register-options",
    ),
  ).toThrow("パスキー登録設定の応答形式が不正です。");
});

test("パスキー以外の応答は変更しない", () => {
  const response = { userVerification: "unchanged" };
  requirePasskeyUV(response, "/api/auth/get-session");
  expect(response).toEqual({ userVerification: "unchanged" });
});

test("認証失敗と結果の欠落を成功扱いにしない", () => {
  expect(() => requireSuccess({ data: null, error: { message: "SESSION_INVALID" } })).toThrow(
    "SESSION_INVALID",
  );
  expect(() => requireSuccess({ data: null, error: null })).toThrow("結果が返りませんでした");
  expect(() => requireSuccess({ data: undefined, error: null })).toThrow("結果が返りませんでした");
  expect(requireSuccess({ data: { status: true }, error: null })).toEqual({ status: true });
});

test("セッションの強度とロールを応答から明示的に検証する", () => {
  const user = {
    id: "user-id",
    name: "名前",
    email: "user@example.com",
    role: "user",
    twoFactorEnabled: false,
  };
  const decode = Schema.decodeUnknownSync(SessionView);
  expect(decode({ user, strong: false })).toEqual({ user, strong: false });
  expect(() => decode({ user })).toThrow("strong");
  expect(() => decode({ user, strong: "true" })).toThrow("boolean");
  expect(() => decode({ user: { ...user, role: "root" }, strong: true })).toThrow("role");
});

test("失敗理由は HTML に変換せず文字列として扱う", () => {
  expect(errorMessage(new Error("<script>alert(1)</script>"))).toBe("<script>alert(1)</script>");
  expect(errorMessage(null)).toBe("操作に失敗しました。もう一度お試しください。");
});
