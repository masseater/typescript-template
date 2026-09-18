import { Schema } from "effect";
import { formValidator } from "./form";

const minimumPasswordLength = 12;
const maximumPasswordLength = 128;
const maximumNameLength = 100;
const totpLength = 6;
const totpPattern = /^\d{6}$/u;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

const isEmail = Schema.isPattern(emailPattern, {
  message: "メールアドレスの形式で入力してください。",
});
const isFilled = Schema.isMinLength(1, { message: "パスワードを入力してください。" });
const isPersonName = Schema.isLengthBetween(1, maximumNameLength, {
  message: `ユーザー名は 1〜${maximumNameLength} 文字で入力してください。`,
});
const isPasskeyName = Schema.isLengthBetween(1, maximumNameLength, {
  message: `パスキーの名前は 1〜${maximumNameLength} 文字で入力してください。`,
});
const isStrongPassword = Schema.isLengthBetween(minimumPasswordLength, maximumPasswordLength, {
  message: `パスワードは ${minimumPasswordLength}〜${maximumPasswordLength} 文字で入力してください。`,
});
const isTotpCode = Schema.isPattern(totpPattern, {
  message: `確認コードは ${totpLength} 桁の数字で入力してください。`,
});
const isBackupCode = Schema.isMinLength(1, {
  message: "バックアップコードを入力してください。",
});

const emailAddress = Schema.String.check(isEmail);
const currentPassword = Schema.String.check(isFilled);

const SignIn = formValidator(Schema.Struct({ email: emailAddress, password: currentPassword }));

const SignUp = formValidator(
  Schema.Struct({
    email: emailAddress,
    name: Schema.Trim.check(isPersonName),
    password: Schema.String.check(isStrongPassword),
  }),
);

const TotpCode = formValidator(Schema.Struct({ code: Schema.String.check(isTotpCode) }));

const BackupCode = formValidator(Schema.Struct({ code: Schema.Trim.check(isBackupCode) }));

const PasskeyName = formValidator(Schema.Struct({ name: Schema.Trim.check(isPasskeyName) }));

const CurrentPassword = formValidator(Schema.Struct({ password: currentPassword }));

export {
  BackupCode,
  CurrentPassword,
  PasskeyName,
  SignIn,
  SignUp,
  TotpCode,
  maximumNameLength,
  maximumPasswordLength,
  minimumPasswordLength,
  totpLength,
};
