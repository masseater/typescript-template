import type { SessionView as SessionContract } from "@template/runtime/contracts";

export type SessionView = typeof SessionContract.Type;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "操作に失敗しました。もう一度お試しください。";
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
  if (!isRecord(data)) throw new Error("パスキー設定の応答形式が不正です。");
  if (pathname.endsWith("/passkey/generate-authenticate-options")) {
    data["userVerification"] = "required";
  } else {
    const selection = data["authenticatorSelection"];
    if (selection !== undefined && !isRecord(selection)) {
      throw new Error("パスキー登録設定の応答形式が不正です。");
    }
    data["authenticatorSelection"] = { ...selection, userVerification: "required" };
  }
}
