import { decodeJson } from "@repo/runtime/client";
import { SessionView } from "@repo/runtime/contracts";
import { describe, expect, test } from "vite-plus/test";

import { errorMessage, passkeyUVOptions, requireSuccess } from "./protocol.ts";

const authenticateOptionsPathname = "/api/auth/passkey/generate-authenticate-options";
const registerOptionsPathname = "/api/auth/passkey/generate-register-options";

describe("パスキー応答の本人確認", () => {
  const it = test
    .extend("theAuthenticationOptions", () =>
      passkeyUVOptions(
        { challenge: "challenge", userVerification: "preferred" },
        authenticateOptionsPathname,
      ))
    .extend("theRegistrationOptionsCarryingAnAuthenticatorSelection", () =>
      passkeyUVOptions(
        { authenticatorSelection: { residentKey: "required", userVerification: "discouraged" } },
        registerOptionsPathname,
      ),
    )
    .extend("theRegistrationOptionsWithoutAnAuthenticatorSelection", () =>
      passkeyUVOptions({ challenge: "challenge" }, registerOptionsPathname),
    );

  it("認証要求では既存の challenge を維持して本人確認を必須にする", ({
    theAuthenticationOptions,
  }) => {
    expect(theAuthenticationOptions).toStrictEqual({
      challenge: "challenge",
      userVerification: "required",
    });
  });

  it("登録要求では認証器の指定を維持して本人確認を必須にする", ({
    theRegistrationOptionsCarryingAnAuthenticatorSelection,
  }) => {
    expect(theRegistrationOptionsCarryingAnAuthenticatorSelection).toStrictEqual({
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
    });
  });

  it("登録要求に認証器の指定がなくても本人確認を必須にする", ({
    theRegistrationOptionsWithoutAnAuthenticatorSelection,
  }) => {
    expect(theRegistrationOptionsWithoutAnAuthenticatorSelection).toStrictEqual({
      authenticatorSelection: { userVerification: "required" },
      challenge: "challenge",
    });
  });
});

describe("パスキー応答の形式検証", () => {
  const it = test
    .extend("theRefusalOfANonRecordPasskeyResponse", () => {
      try {
        passkeyUVOptions(null, registerOptionsPathname);
      } catch (refusal) {
        return refusal;
      }
      throw new Error("passkeyUVOptions accepted a passkey response that is not a record");
    })
    .extend("theRefusalOfAnInvalidAuthenticatorSelection", () => {
      try {
        passkeyUVOptions({ authenticatorSelection: "invalid" }, registerOptionsPathname);
      } catch (refusal) {
        return refusal;
      }
      throw new Error("passkeyUVOptions accepted an authenticator selection that is not a record");
    });

  it("レコードでないパスキー設定の応答を拒否する", ({ theRefusalOfANonRecordPasskeyResponse }) => {
    expect(theRefusalOfANonRecordPasskeyResponse).toStrictEqual(
      new Error("パスキー設定の応答形式が不正です。"),
    );
  });

  it("レコードでない認証器の指定を拒否する", ({ theRefusalOfAnInvalidAuthenticatorSelection }) => {
    expect(theRefusalOfAnInvalidAuthenticatorSelection).toStrictEqual(
      new Error("パスキー登録設定の応答形式が不正です。"),
    );
  });
});

describe("認証結果の検証", () => {
  const it = test
    .extend("theRefusalOfAnAuthenticationFailure", () => {
      try {
        requireSuccess({ data: null, error: { message: "SESSION_INVALID" } });
      } catch (refusal) {
        return refusal;
      }
      throw new Error("requireSuccess accepted an authentication failure");
    })
    .extend("theRefusalOfANullPayload", () => {
      try {
        requireSuccess({ data: null, error: null });
      } catch (refusal) {
        return refusal;
      }
      throw new Error("requireSuccess accepted a null payload");
    })
    .extend("theRefusalOfAMissingPayload", () => {
      try {
        requireSuccess({ data: undefined, error: null });
      } catch (refusal) {
        return refusal;
      }
      throw new Error("requireSuccess accepted a missing payload");
    })
    .extend("theAcceptedPayload", () => requireSuccess({ data: { status: true }, error: null }));

  it("認証の失敗を成功扱いにしない", ({ theRefusalOfAnAuthenticationFailure }) => {
    expect(theRefusalOfAnAuthenticationFailure).toStrictEqual(new Error("SESSION_INVALID"));
  });

  it("結果が null の応答を成功扱いにしない", ({ theRefusalOfANullPayload }) => {
    expect(theRefusalOfANullPayload).toStrictEqual(
      new Error("認証サーバーから結果が返りませんでした。"),
    );
  });

  it("結果が欠けた応答を成功扱いにしない", ({ theRefusalOfAMissingPayload }) => {
    expect(theRefusalOfAMissingPayload).toStrictEqual(
      new Error("認証サーバーから結果が返りませんでした。"),
    );
  });

  it("結果を伴う成功はそのまま渡す", ({ theAcceptedPayload }) => {
    expect(theAcceptedPayload).toStrictEqual({ status: true });
  });
});

describe("セッション応答の検証", () => {
  const signedInUser = {
    email: "user@example.com",
    id: "user-id",
    name: "名前",
    role: "user",
    twoFactorEnabled: false,
  };
  const malformedSessionMessage = "サーバーの応答形式が不正です。";
  const it = test
    .extend("theDecodedSession", () =>
      decodeJson(SessionView, { strong: false, user: signedInUser }))
    .extend("theRefusalOfASessionWithoutStrength", () => {
      try {
        decodeJson(SessionView, { user: signedInUser });
      } catch (refusal) {
        return refusal;
      }
      throw new Error("decodeJson accepted a session without strength");
    })
    .extend("theRefusalOfASessionWhoseStrengthIsText", () => {
      try {
        decodeJson(SessionView, { strong: "true", user: signedInUser });
      } catch (refusal) {
        return refusal;
      }
      throw new Error("decodeJson accepted a session whose strength is text");
    })
    .extend("theRefusalOfASessionCarryingAnUnknownRole", () => {
      try {
        decodeJson(SessionView, { strong: true, user: { ...signedInUser, role: "root" } });
      } catch (refusal) {
        return refusal;
      }
      throw new Error("decodeJson accepted a session carrying an unknown role");
    });

  it("強度とロールを備えた応答をそのまま読む", ({ theDecodedSession }) => {
    expect(theDecodedSession).toStrictEqual({ strong: false, user: signedInUser });
  });

  it("強度を持たない応答を拒否する", ({ theRefusalOfASessionWithoutStrength }) => {
    expect(theRefusalOfASessionWithoutStrength).toStrictEqual(new Error(malformedSessionMessage));
  });

  it("強度が文字列の応答を拒否する", ({ theRefusalOfASessionWhoseStrengthIsText }) => {
    expect(theRefusalOfASessionWhoseStrengthIsText).toStrictEqual(
      new Error(malformedSessionMessage),
    );
  });

  it("知らないロールを持つ応答を拒否する", ({ theRefusalOfASessionCarryingAnUnknownRole }) => {
    expect(theRefusalOfASessionCarryingAnUnknownRole).toStrictEqual(
      new Error(malformedSessionMessage),
    );
  });
});

describe("失敗理由の文言", () => {
  const it = test
    .extend("theMessageOfAThrownError", () => errorMessage(new Error("<script>alert(1)</script>")))
    .extend("theMessageOfAThrownString", () => errorMessage("<script>alert(1)</script>"))
    .extend("theRefusalOfAKnownFailureCode", () => {
      try {
        requireSuccess({
          data: undefined,
          error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Upstream wording" },
        });
      } catch (refusal) {
        return refusal;
      }
      throw new Error("requireSuccess accepted a known failure code");
    })
    .extend("theRefusalOfAnUnverifiedEmail", () => {
      try {
        requireSuccess({
          data: undefined,
          error: { code: "EMAIL_NOT_VERIFIED", message: "Upstream wording" },
        });
      } catch (refusal) {
        return refusal;
      }
      throw new Error("requireSuccess accepted an unverified email");
    })
    .extend("theRefusalOfAnInvalidCode", () => {
      try {
        requireSuccess({
          data: undefined,
          error: { code: "INVALID_CODE", message: "Upstream wording" },
        });
      } catch (refusal) {
        return refusal;
      }
      throw new Error("requireSuccess accepted an invalid code");
    })
    .extend("theRefusalOfAnInvalidBackupCode", () => {
      try {
        requireSuccess({
          data: undefined,
          error: { code: "INVALID_BACKUP_CODE", message: "Upstream wording" },
        });
      } catch (refusal) {
        return refusal;
      }
      throw new Error("requireSuccess accepted an invalid backup code");
    })
    .extend("theRefusalOfAnUnmappedFailureCode", () => {
      try {
        requireSuccess({
          data: undefined,
          error: { code: "SOMETHING_ELSE", message: "Upstream wording" },
        });
      } catch (refusal) {
        return refusal;
      }
      throw new Error("requireSuccess accepted an unmapped failure code");
    })
    .extend("theRefusalOfAMissingFailureCode", () => {
      try {
        requireSuccess({ data: undefined, error: {} });
      } catch (refusal) {
        return refusal;
      }
      throw new Error("requireSuccess accepted a missing failure code");
    })
    .extend("theRefusalOfAMessageOnlyFailure", () => {
      try {
        requireSuccess({ data: undefined, error: { message: "message only" } });
      } catch (refusal) {
        return refusal;
      }
      throw new Error("requireSuccess accepted a message-only failure");
    })
    .extend("theRefusalOfAnUnknownCodeWithoutMessage", () => {
      try {
        requireSuccess({ data: undefined, error: { code: "SOMETHING_ELSE" } });
      } catch (refusal) {
        return refusal;
      }
      throw new Error("requireSuccess accepted an unknown code without a message");
    });

  it("投げられた Error の文言をそのまま出す", ({ theMessageOfAThrownError }) => {
    expect(theMessageOfAThrownError).toBe("<script>alert(1)</script>");
  });

  it("Error でない失敗には共通の文言を出す", ({ theMessageOfAThrownString }) => {
    expect(theMessageOfAThrownString).toBe("操作に失敗しました。もう一度お試しください。");
  });

  it("ログインの失敗を画面に出す理由へ変える", ({ theRefusalOfAKnownFailureCode }) => {
    expect(theRefusalOfAKnownFailureCode).toStrictEqual(
      new Error("メールアドレスかパスワードが違います。"),
    );
  });

  it("メール未確認を画面に出す理由へ変える", ({ theRefusalOfAnUnverifiedEmail }) => {
    expect(theRefusalOfAnUnverifiedEmail).toStrictEqual(
      new Error("メールアドレスが未確認です。確認メールのリンクを開いてください。"),
    );
  });

  it("確認コードの誤りを画面に出す理由へ変える", ({ theRefusalOfAnInvalidCode }) => {
    expect(theRefusalOfAnInvalidCode).toStrictEqual(new Error("確認コードが違います。"));
  });

  it("バックアップコードの誤りを画面に出す理由へ変える", ({ theRefusalOfAnInvalidBackupCode }) => {
    expect(theRefusalOfAnInvalidBackupCode).toStrictEqual(
      new Error("バックアップコードが違います。"),
    );
  });

  it("理由を持たない失敗コードは認証サーバーの文言のまま出す", ({
    theRefusalOfAnUnmappedFailureCode,
  }) => {
    expect(theRefusalOfAnUnmappedFailureCode).toStrictEqual(new Error("Upstream wording"));
  });

  it("コードが無い失敗を空キーの辞書引きで汎用文言にしない", ({
    theRefusalOfAMissingFailureCode,
  }) => {
    expect(theRefusalOfAMissingFailureCode).toStrictEqual(
      new Error("認証サーバーが失敗理由のコードを返しませんでした。"),
    );
  });

  it("コードが無くメッセージだけの失敗は認証サーバーの文言のまま出す", ({
    theRefusalOfAMessageOnlyFailure,
  }) => {
    expect(theRefusalOfAMessageOnlyFailure).toStrictEqual(new Error("message only"));
  });

  it("未知のコードをメッセージ欠落のまま汎用文言にしない", ({
    theRefusalOfAnUnknownCodeWithoutMessage,
  }) => {
    expect(theRefusalOfAnUnknownCodeWithoutMessage).toStrictEqual(
      new Error("認証サーバーが未知の失敗コードを返しました: SOMETHING_ELSE"),
    );
  });
});
