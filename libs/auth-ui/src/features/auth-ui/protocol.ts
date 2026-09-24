import { accountPermissions, roles } from "@repo/config";
import { Predicate, Result, Schema } from "effect";

const SessionView = Schema.Struct({
  strong: Schema.Boolean,
  user: Schema.Struct({
    email: Schema.String,
    id: Schema.String,
    name: Schema.String,
    permission: Schema.NullOr(Schema.Literals(accountPermissions)),
    role: Schema.Literals(roles),
    twoFactorEnabled: Schema.Boolean,
  }),
});

const decodeJson = <Contract extends Schema.Top & { readonly DecodingServices: never }>(
  contract: Contract,
  input: unknown,
): Contract["Type"] => {
  const decoded = Schema.decodeUnknownResult(contract)(input);
  if (Result.isFailure(decoded)) {
    throw new Error("サーバーの応答形式が不正です。");
  }
  return decoded.success;
};

const errorMessage = (failure: unknown): string => {
  return failure instanceof Error
    ? failure.message
    : "操作に失敗しました。もう一度お試しください。";
};

const failureReasons: Readonly<Record<string, string>> = {
  "Email is the same": "いまのメールアドレスと同じです。",
  EMAIL_NOT_VERIFIED: "メールアドレスが未確認です。確認メールのリンクを開いてください。",
  INVALID_BACKUP_CODE: "バックアップコードが違います。",
  INVALID_CODE: "確認コードが違います。",
  INVALID_EMAIL_OR_PASSWORD: "メールアドレスかパスワードが違います。",
  STRONG_AUTH_REQUIRED: "認証アプリかパスキーで確認してから、もう一度お試しください。",
};

const authFailureMessage = (
  authFailure: Readonly<{ code?: string | undefined; message?: string | undefined }>,
): string => {
  const { code, message } = authFailure;
  const known = failureReasons[code ?? message ?? ""];
  if (known !== undefined) {
    return known;
  }
  if (code === undefined) {
    return message ?? "認証サーバーが失敗理由のコードを返しませんでした。";
  }
  return message ?? `認証サーバーが未知の失敗コードを返しました: ${code}`;
};

const requireSuccess = <TData>(
  authEnvelope: Readonly<{
    data: TData;
    error: Readonly<{ code?: string | undefined; message?: string | undefined }> | null;
  }>,
): NonNullable<TData> => {
  if (authEnvelope.error) {
    throw new Error(authFailureMessage(authEnvelope.error));
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

const registrationWithUserVerification = (
  passkeyOptions: Readonly<Record<string, unknown>>,
): Record<string, unknown> => {
  const selection = passkeyOptions["authenticatorSelection"];
  if (selection !== undefined && !Predicate.isObject(selection)) {
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
  if (!Predicate.isObject(passkeyOptions)) {
    throw new Error("パスキー設定の応答形式が不正です。");
  }
  return pathname.endsWith(authenticateOptionsPath)
    ? { ...passkeyOptions, userVerification: "required" }
    : registrationWithUserVerification(passkeyOptions);
};

export {
  SessionView,
  decodeJson,
  errorMessage,
  isPasskeyOptionsPath,
  passkeyUVOptions,
  requireSecureContext,
  requireSuccess,
};
export type SessionView = typeof SessionView.Type;
