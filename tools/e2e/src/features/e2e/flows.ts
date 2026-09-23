import { Effect } from "effect";

import { appearanceTimeout, field, fill, pageStep, press, readyButton } from "./screens.ts";
import { currentTotpCode } from "./totp.ts";

import type { Page } from "playwright";
import type { Account } from "./accounts.ts";
import type { JourneyFailure } from "./journey-failure.ts";
import type { MailSink } from "./mail.ts";

type Visit = {
  readonly account: Account;
  readonly origin: string;
  readonly page: Page;
};

const signUpButton = "登録する";

const signUp = (visit: Visit): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* signUpAccount() {
    yield* pageStep(() => visit.page.goto(`${visit.origin}/signup`));
    yield* readyButton(visit.page, signUpButton);
    yield* fill(visit.page, { fieldLabel: "ユーザー名", typed: visit.account.name });
    yield* fill(visit.page, { fieldLabel: "メールアドレス", typed: visit.account.email });
    yield* fill(visit.page, {
      fieldLabel: "パスワード（12文字以上）",
      typed: visit.account.password,
    });
    yield* press(visit.page, signUpButton);
  });

const confirmEmail = (
  delivery: Visit & { readonly mail: MailSink },
): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* followVerificationLink() {
    const link = yield* delivery.mail.waitForLink(
      delivery.account.email,
      `${delivery.origin}/verify-email`,
    );
    yield* pageStep(() => delivery.page.goto(link));
    yield* pageStep(() =>
      delivery.page.waitForURL(`${delivery.origin}/login`, { timeout: appearanceTimeout }),
    );
  });

const signInButton = "ログイン";

const signIn = (visit: Visit): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* signInAccount() {
    yield* pageStep(() => visit.page.goto(`${visit.origin}/login`));
    yield* readyButton(visit.page, signInButton);
    yield* fill(visit.page, { fieldLabel: "メールアドレス", typed: visit.account.email });
    yield* fill(visit.page, { fieldLabel: "パスワード", typed: visit.account.password });
    yield* press(visit.page, signInButton);
  });

const totpLabel = "認証アプリの確認コード";
const totpChallengeButton = "確認コードでログイン";

const answerTotpChallenge = (page: Page, uri: string): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* answerTotp() {
    yield* readyButton(page, totpChallengeButton);
    yield* fill(page, { fieldLabel: totpLabel, typed: currentTotpCode(uri) });
    yield* press(page, totpChallengeButton);
  });

const enrollButton = "認証アプリの登録を開始";

const beginEnrollment = (visit: Visit): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* startEnrollment() {
    yield* pageStep(() => visit.page.goto(`${visit.origin}/settings/security`));
    yield* readyButton(visit.page, enrollButton);
    yield* fill(visit.page, {
      fieldLabel: "設定変更を確認するパスワード",
      typed: visit.account.password,
    });
    yield* press(visit.page, enrollButton);
  });

type Enrollment = {
  readonly backupCodes: readonly string[];
  readonly uri: string;
};

const readEnrollment = (page: Page): Effect.Effect<Enrollment, JourneyFailure> =>
  Effect.gen(function* readEnrollmentDetails() {
    const uriField = field(page, "認証アプリ登録用 URI");
    yield* pageStep(() => uriField.waitFor({ state: "visible", timeout: appearanceTimeout }));
    const codes = page.getByRole("list", { name: "バックアップコード" }).getByRole("listitem");
    const backupCodes = yield* pageStep(() => codes.allInnerTexts());
    const uri = yield* pageStep(() => uriField.inputValue());
    return { backupCodes, uri };
  });

const activateButton = "確認して認証アプリを有効化";
const homePattern = "/home";

const enrollTotp = (visit: Visit): Effect.Effect<Enrollment, JourneyFailure> =>
  Effect.gen(function* enrollAuthenticator() {
    yield* beginEnrollment(visit);
    const enrollment = yield* readEnrollment(visit.page);
    const stored = visit.page
      .getByRole("checkbox", { name: "バックアップコードを保管しました" })
      .first();
    yield* pageStep(() => stored.click());
    yield* fill(visit.page, { fieldLabel: totpLabel, typed: currentTotpCode(enrollment.uri) });
    yield* press(visit.page, activateButton);
    yield* pageStep(() =>
      visit.page.waitForURL(`${visit.origin}${homePattern}`, { timeout: appearanceTimeout }),
    );
    return enrollment;
  });

const signOutButton = "ログアウト";

const leftSecuritySettings = (url: { readonly pathname: string }): boolean =>
  !url.pathname.startsWith("/settings/security");

const signOut = (page: Page, origin: string): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* signOutAccount() {
    yield* pageStep(() => page.goto(`${origin}/settings/security`));
    yield* press(page, signOutButton);
    yield* pageStep(() => page.waitForURL(leftSecuritySettings, { timeout: appearanceTimeout }));
    yield* pageStep(() => page.goto(`${origin}/login`));
    yield* readyButton(page, signInButton);
  });

export { answerTotpChallenge, confirmEmail, enrollTotp, homePattern, signIn, signOut, signUp };
