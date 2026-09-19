import { Schema } from "effect";

import type { SessionView as SessionContract } from "@repo/runtime/contracts";

type SessionView = typeof SessionContract.Type;

const errorMessage = (failure: unknown): string => {
  return failure instanceof Error
    ? failure.message
    : "操作に失敗しました。もう一度お試しください。";
};

const failureReasons: Readonly<Record<string, string>> = {
  EMAIL_NOT_VERIFIED: "メールアドレスが未確認です。確認メールのリンクを開いてください。",
  INVALID_BACKUP_CODE: "バックアップコードが違います。",
  INVALID_CODE: "確認コードが違います。",
  INVALID_EMAIL_OR_PASSWORD: "メールアドレスかパスワードが違います。",
};

const requireSuccess = <TData>(
  authEnvelope: Readonly<{
    data: TData;
    error: Readonly<{ code?: string | undefined; message?: string | undefined }> | null;
  }>,
): NonNullable<TData> => {
  if (authEnvelope.error) {
    throw new Error(
      failureReasons[authEnvelope.error.code ?? ""] ??
        authEnvelope.error.message ??
        "認証サーバーが操作を拒否しました。",
    );
  }
  if (authEnvelope.data === null || authEnvelope.data === undefined) {
    throw new Error("認証サーバーから結果が返りませんでした。");
  }
  return authEnvelope.data;
};

const requireSecureContext = (): void => {
  if (!globalThis.isSecureContext) {
    throw new Error("パスキーには HTTPS または localhost が必要です。");
  }
};

const authenticateOptionsPath = "/passkey/generate-authenticate-options";
const registerOptionsPath = "/passkey/generate-register-options";

const isPasskeyOptionsPath = (pathname: string): boolean => {
  return pathname.endsWith(authenticateOptionsPath) || pathname.endsWith(registerOptionsPath);
};

const isRecord = Schema.is(Schema.Record(Schema.String, Schema.Unknown));

const isUnknownRecord = (candidate: unknown): candidate is Record<string, unknown> => {
  return isRecord(candidate);
};

const registrationWithUserVerification = (
  passkeyOptions: Readonly<Record<string, unknown>>,
): Record<string, unknown> => {
  const selection = passkeyOptions["authenticatorSelection"];
  if (selection !== undefined && !isUnknownRecord(selection)) {
    throw new Error("パスキー登録設定の応答形式が不正です。");
  }
  return {
    ...passkeyOptions,
    authenticatorSelection: { ...selection, userVerification: "required" },
  };
};

const passkeyUVOptions = (
  passkeyOptions: unknown,
  pathname: string,
): Readonly<Record<string, unknown>> => {
  if (!isUnknownRecord(passkeyOptions)) {
    throw new Error("パスキー設定の応答形式が不正です。");
  }
  return pathname.endsWith(authenticateOptionsPath)
    ? { ...passkeyOptions, userVerification: "required" }
    : registrationWithUserVerification(passkeyOptions);
};

export {
  errorMessage,
  isPasskeyOptionsPath,
  passkeyUVOptions,
  requireSecureContext,
  requireSuccess,
};
export type { SessionView };
