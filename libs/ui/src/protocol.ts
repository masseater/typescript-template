import { roles } from "@template/config";
import * as v from "valibot";

export const sessionSchema = v.object({
  user: v.object({
    id: v.string(),
    name: v.string(),
    email: v.pipe(v.string(), v.email()),
    role: v.picklist(roles),
    twoFactorEnabled: v.boolean(),
  }),
  strong: v.boolean(),
});
export type SessionView = v.InferOutput<typeof sessionSchema>;

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "操作に失敗しました。もう一度お試しください。";
}

export function requireSecureContext(): void {
  if (!window.isSecureContext) throw new Error("パスキーには HTTPS または localhost が必要です。");
}

export function requireSuccess<T>(result: {
  data: T;
  error: { message?: string | undefined } | null;
}): NonNullable<T> {
  if (result.error) throw new Error(result.error.message ?? "認証サーバーが操作を拒否しました。");
  if (result.data === null || result.data === undefined)
    throw new Error("認証サーバーから結果が返りませんでした。");
  return result.data;
}

export function requirePasskeyUV(data: unknown, pathname: string): void {
  if (
    !pathname.endsWith("/passkey/generate-authenticate-options") &&
    !pathname.endsWith("/passkey/generate-register-options")
  )
    return;
  if (!v.is(v.record(v.string(), v.unknown()), data))
    throw new Error("パスキー設定の応答形式が不正です。");
  if (pathname.endsWith("/passkey/generate-authenticate-options")) {
    data["userVerification"] = "required";
  } else {
    const selection = data["authenticatorSelection"];
    if (selection !== undefined && !v.is(v.record(v.string(), v.unknown()), selection)) {
      throw new Error("パスキー登録設定の応答形式が不正です。");
    }
    data["authenticatorSelection"] = { ...selection, userVerification: "required" };
  }
}
