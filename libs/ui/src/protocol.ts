import { Schema } from "effect";

import type { SessionView as SessionContract } from "@template/runtime/contracts";

const isRecord = Schema.is(Schema.Record(Schema.String, Schema.Unknown));

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}

type SessionView = typeof SessionContract.Type;

interface AuthResult<TData> {
  readonly data: TData;
  readonly error: Readonly<{ code?: string | undefined; message?: string | undefined }> | null;
}

const failureReasons: Readonly<Record<string, string>> = {
  EMAIL_NOT_VERIFIED: "メールアドレスが未確認です。確認メールのリンクを開いてください。",
  INVALID_BACKUP_CODE: "バックアップコードが違います。",
  INVALID_CODE: "確認コードが違います。",
  INVALID_EMAIL_OR_PASSWORD: "メールアドレスかパスワードが違います。",
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "操作に失敗しました。もう一度お試しください。";
}

function requireSuccess<TData>(result: AuthResult<TData>): NonNullable<TData> {
  if (result.error) {
    throw new Error(
      failureReasons[result.error.code ?? ""] ??
        result.error.message ??
        "認証サーバーが操作を拒否しました。",
    );
  }
  if (result.data === null || result.data === undefined) {
    throw new Error("認証サーバーから結果が返りませんでした。");
  }
  return result.data;
}

function requireSecureContext(): void {
  if (!globalThis.isSecureContext) {
    throw new Error("パスキーには HTTPS または localhost が必要です。");
  }
}

function requirePasskeyUV(data: unknown, pathname: string): void {
  if (
    !pathname.endsWith("/passkey/generate-authenticate-options") &&
    !pathname.endsWith("/passkey/generate-register-options")
  ) {
    return;
  }
  if (!isUnknownRecord(data)) {
    throw new Error("パスキー設定の応答形式が不正です。");
  }
  if (pathname.endsWith("/passkey/generate-authenticate-options")) {
    data["userVerification"] = "required";
  } else {
    const selection = data["authenticatorSelection"];
    if (selection !== undefined && !isUnknownRecord(selection)) {
      throw new Error("パスキー登録設定の応答形式が不正です。");
    }
    data["authenticatorSelection"] = { ...selection, userVerification: "required" };
  }
}

export { errorMessage, requirePasskeyUV, requireSecureContext, requireSuccess };
export type { SessionView };
