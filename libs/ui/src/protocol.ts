import {
  boolean,
  email,
  is,
  object,
  picklist,
  pipe,
  readonly,
  record,
  string,
  unknown,
} from "valibot";
import type { InferOutput } from "valibot";
import { roles } from "@template/config";

const unknownRecordSchema = record(string(), unknown());
const emailSchema = pipe(string(), email());
const sessionUserSchema = pipe(
  object({
    email: emailSchema,
    id: string(),
    name: string(),
    role: picklist(roles),
    twoFactorEnabled: boolean(),
  }),
  readonly(),
);
const sessionSchema = pipe(object({ strong: boolean(), user: sessionUserSchema }), readonly());

type SessionView = InferOutput<typeof sessionSchema>;

interface AuthResult<TData> {
  readonly data: TData;
  readonly error: Readonly<{ message?: string | undefined }> | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "操作に失敗しました。もう一度お試しください。";
}

function requireSuccess<TData>(result: AuthResult<TData>): NonNullable<TData> {
  if (result.error) {
    throw new Error(result.error.message ?? "認証サーバーが操作を拒否しました。");
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
  if (!is(unknownRecordSchema, data)) {
    throw new Error("パスキー設定の応答形式が不正です。");
  }
  if (pathname.endsWith("/passkey/generate-authenticate-options")) {
    data["userVerification"] = "required";
  } else {
    const selection = data["authenticatorSelection"];
    if (selection !== undefined && !is(unknownRecordSchema, selection)) {
      throw new Error("パスキー登録設定の応答形式が不正です。");
    }
    data["authenticatorSelection"] = { ...selection, userVerification: "required" };
  }
}

export { errorMessage, requirePasskeyUV, requireSecureContext, requireSuccess, sessionSchema };
export type { SessionView };
