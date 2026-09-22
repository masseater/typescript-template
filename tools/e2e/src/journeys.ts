import { Crypto, Effect } from "effect";

import { type Account, newAccount } from "./accounts.ts";
import { agentUserAgent } from "./agent-user-agent.ts";
import {
  answerTotpChallenge,
  confirmEmail,
  enrollTotp,
  homePattern,
  signIn,
  signOut,
  signUp,
} from "./flows.ts";
import { failed, type JourneyFailure } from "./journey-failure.ts";
import {
  appearanceTimeout,
  fill,
  pageStep,
  press,
  readyButton,
  seeAnyHeading,
  seeHeading,
  seeText,
} from "./screens.ts";
import { runVerifyMember } from "./verify-member.ts";

import type { Page } from "playwright";
import type { JourneyEnvironment } from "./environment.ts";

const saveAndOpenHome = (page: Page, origin: string): Effect.Effect<void, JourneyFailure> =>
  Effect.all(
    [
      pageStep(() => page.waitForURL(`${origin}${homePattern}`, { timeout: appearanceTimeout })),
      press(page, "保存してホームへ"),
    ],
    { concurrency: "unbounded" },
  ).pipe(Effect.asVoid);

type JourneyStage = {
  readonly environment: JourneyEnvironment;
  readonly page: Page;
};

const isWelcomePath = (url: { readonly pathname: string }): boolean =>
  url.pathname.includes("/welcome");

const completeWelcomeOnboarding = (
  stage: JourneyStage,
  visit: { readonly account: Account; readonly origin: string },
): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* finishWelcome() {
    const { page } = stage;
    yield* pageStep(() => page.waitForURL(isWelcomePath, { timeout: appearanceTimeout }));
    yield* seeHeading(page, "規約への同意");
    yield* press(page, "同意して続ける");
    yield* seeHeading(page, "プロフィールの作り方");
    yield* press(page, "自分で入力する");
    yield* seeHeading(page, "基本項目の入力");
    yield* fill(page, { fieldLabel: "ユーザー名", typed: visit.account.name });
    yield* saveAndOpenHome(page, visit.origin);
  });

const signUpAndConfirm = (
  stage: JourneyStage,
  role: "member" | "operator",
): Effect.Effect<
  { readonly account: Account; readonly origin: string },
  JourneyFailure,
  Crypto.Crypto
> =>
  Effect.gen(function* registerAndEnter() {
    const origin = stage.environment.originOf("member");
    const account = yield* newAccount(role);
    yield* signUp({ account, origin, page: stage.page });
    yield* seeHeading(stage.page, "確認メールを送りました");
    yield* confirmEmail({ account, mail: stage.environment.mail, origin, page: stage.page });
    yield* signIn({ account, origin, page: stage.page });
    yield* completeWelcomeOnboarding(stage, { account, origin });
    return { account, origin };
  });

const openMainNav = (
  stage: JourneyStage,
  destination: Readonly<{ heading: string; linkName: string }>,
): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* followMainNav() {
    yield* pageStep(() =>
      stage.page.getByRole("link", { exact: true, name: destination.linkName }).first().click(),
    );
    yield* seeHeading(stage.page, destination.heading);
  });

const browseMainScreens = (
  stage: JourneyStage,
  account: Account,
): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* browseMemberScreens() {
    const origin = stage.environment.originOf("member");
    yield* seeHeading(stage.page, "ホーム");
    yield* openMainNav(stage, { heading: account.name, linkName: "プロフィール" });
    yield* openMainNav(stage, { heading: "掲示板", linkName: "掲示板" });
    yield* openMainNav(stage, { heading: "ホーム", linkName: "ホーム" });
    yield* pageStep(() => stage.page.goto(`${origin}/users`));
    yield* pageStep(() =>
      stage.page.waitForURL(`${origin}/upgrade`, { timeout: appearanceTimeout }),
    );
    yield* seeHeading(stage.page, "有料プラン");
  });

const openNewThreadForm = (page: Page, origin: string): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* openThreadForm() {
    yield* pageStep(() => page.goto(`${origin}/board`));
    yield* seeHeading(page, "掲示板");
    yield* pageStep(() => page.getByRole("link", { exact: true, name: "新しいスレッド" }).click());
    yield* pageStep(() =>
      page.waitForURL(`${origin}/board?new=true`, { timeout: appearanceTimeout }),
    );
    yield* readyButton(page, "投稿する");
  });

const freshLabel = (prefix: string): Effect.Effect<string, never, Crypto.Crypto> =>
  Effect.gen(function* labelWithIdentifier() {
    const crypto = yield* Crypto.Crypto;
    const identifier = yield* crypto.randomUUIDv4.pipe(Effect.orDie);
    return `${prefix} ${identifier}`;
  });

const openThread = (
  page: Page,
  origin: string,
): Effect.Effect<string, JourneyFailure, Crypto.Crypto> =>
  Effect.gen(function* publishThread() {
    const title = yield* freshLabel("journey");
    yield* openNewThreadForm(page, origin);
    yield* fill(page, { fieldLabel: "題", typed: title });
    yield* fill(page, { fieldLabel: "本文", typed: "最初の投稿です。" });
    yield* press(page, "投稿する");
    yield* pageStep(() => page.waitForURL(`${origin}/board/*`, { timeout: appearanceTimeout }));
    yield* seeHeading(page, title);
    return title;
  });

const replyOnThread = (page: Page): Effect.Effect<boolean, JourneyFailure, Crypto.Crypto> =>
  Effect.gen(function* publishReply() {
    const replyBody = yield* freshLabel("reply");
    yield* readyButton(page, "投稿する");
    yield* fill(page, { fieldLabel: "返信", typed: replyBody });
    yield* press(page, "投稿する");
    yield* seeText(page, replyBody);
    return yield* pageStep(() => page.getByText(replyBody, { exact: false }).first().isVisible());
  });

const postOnBoard = (
  stage: JourneyStage,
  origin: string,
): Effect.Effect<
  { readonly listsTheThreadAfterwards: boolean; readonly showsTheReply: boolean },
  JourneyFailure,
  Crypto.Crypto
> =>
  Effect.gen(function* postThreadAndReply() {
    const { page } = stage;
    const title = yield* openThread(page, origin);
    const showsTheReply = yield* replyOnThread(page);
    yield* pageStep(() => page.goto(`${origin}/board`));
    yield* seeText(page, title);
    const listsTheThreadAfterwards = yield* pageStep(() =>
      page.getByText(title, { exact: false }).first().isVisible(),
    );
    return { listsTheThreadAfterwards, showsTheReply };
  });

const writeBiography = (
  stage: JourneyStage,
  origin: string,
): Effect.Effect<
  { readonly biography: string; readonly profilePath: string },
  JourneyFailure,
  Crypto.Crypto
> =>
  Effect.gen(function* saveBiography() {
    const biography = yield* freshLabel("journey");
    yield* pageStep(() => stage.page.goto(`${origin}/settings/profile`));
    yield* seeHeading(stage.page, "プロフィールの編集");
    yield* readyButton(stage.page, "保存");
    yield* fill(stage.page, { fieldLabel: "自己紹介", typed: biography });
    yield* press(stage.page, "保存");
    yield* pageStep(() =>
      stage.page.waitForURL(`${origin}/users/*`, { timeout: appearanceTimeout }),
    );
    yield* seeText(stage.page, biography);
    return { biography, profilePath: new URL(stage.page.url()).pathname };
  });

type ListedSetting = { readonly heading: string; readonly name: string };

const openListedSetting = (
  stage: JourneyStage,
  visit: { readonly listedSetting: ListedSetting; readonly origin: string },
): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* openSetting() {
    yield* pageStep(() => stage.page.goto(`${visit.origin}/settings`));
    yield* seeHeading(stage.page, "設定");
    yield* pageStep(() =>
      stage.page
        .getByRole("main")
        .getByRole("list")
        .getByRole("link", { exact: true, name: visit.listedSetting.name })
        .click(),
    );
    yield* seeHeading(stage.page, visit.listedSetting.heading);
  });

const listedSettings = [
  { heading: "プロフィールの編集", name: "プロフィール" },
  { heading: "通知", name: "通知" },
  { heading: "セキュリティ", name: "セキュリティ" },
  { heading: "AI インタビュー", name: "AI インタビュー" },
  { heading: "AI と API", name: "AI と API" },
  { heading: "プランと解約", name: "プランと解約" },
  { heading: "退会", name: "退会" },
] as const satisfies readonly ListedSetting[];

const browseSettings = (
  stage: JourneyStage,
  origin: string,
): Effect.Effect<
  {
    readonly opensEveryListedItem: boolean;
    readonly reachesLeaveInOneClick: boolean;
    readonly reachesPlanInOneClick: boolean;
  },
  JourneyFailure
> =>
  Effect.gen(function* browseEverySetting() {
    yield* openListedSetting(stage, {
      listedSetting: { heading: "プランと解約", name: "プランと解約" },
      origin,
    });
    const reachesPlanInOneClick = stage.page.url().startsWith(`${origin}/settings/plan`);
    yield* openListedSetting(stage, { listedSetting: { heading: "退会", name: "退会" }, origin });
    const reachesLeaveInOneClick = stage.page.url().startsWith(`${origin}/settings/leave`);
    for (const listedSetting of listedSettings) {
      yield* openListedSetting(stage, { listedSetting, origin });
    }
    return { opensEveryListedItem: true, reachesLeaveInOneClick, reachesPlanInOneClick };
  });

const signInAgainWithTotp = (
  stage: JourneyStage,
  enrolled: { readonly account: Account; readonly origin: string; readonly uri: string },
): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* signInWithTotp() {
    yield* signOut(stage.page, enrolled.origin);
    yield* signIn({ account: enrolled.account, origin: enrolled.origin, page: stage.page });
    yield* answerTotpChallenge(stage.page, enrolled.uri);
    yield* pageStep(() =>
      stage.page.waitForURL(`${enrolled.origin}${homePattern}`, { timeout: appearanceTimeout }),
    );
  });

const revisitProfile = (
  page: Page,
  written: { readonly biography: string; readonly profileUrl: string },
): Effect.Effect<boolean, JourneyFailure> =>
  Effect.gen(function* reopenProfile() {
    yield* pageStep(() => page.goto(written.profileUrl));
    yield* seeText(page, written.biography);
    return yield* pageStep(() =>
      page.getByText(written.biography, { exact: false }).first().isVisible(),
    );
  });

const runMemberJourney = (
  stage: JourneyStage,
): Effect.Effect<
  {
    readonly backupCodeCount: number;
    readonly landsOnTheMemberHome: boolean;
    readonly listsTheThreadOpenedEarlier: boolean;
    readonly opensEveryListedSettingsItem: boolean;
    readonly reachesLeaveInOneClick: boolean;
    readonly reachesPlanInOneClick: boolean;
    readonly showsTheBiographyWrittenEarlier: boolean;
    readonly showsTheReplyOnTheThread: boolean;
  },
  JourneyFailure,
  Crypto.Crypto
> =>
  Effect.gen(function* walkMemberJourney() {
    const { account, origin } = yield* signUpAndConfirm(stage, "member");
    yield* browseMainScreens(stage, account);
    const board = yield* postOnBoard(stage, origin);
    const settings = yield* browseSettings(stage, origin);
    const { biography, profilePath } = yield* writeBiography(stage, origin);
    const enrollment = yield* enrollTotp({ account, origin, page: stage.page });
    yield* signInAgainWithTotp(stage, { account, origin, uri: enrollment.uri });
    const landsOnTheMemberHome = stage.page.url().startsWith(`${origin}/home`);
    const showsTheBiographyWrittenEarlier = yield* revisitProfile(stage.page, {
      biography,
      profileUrl: `${origin}${profilePath}`,
    });
    return {
      backupCodeCount: enrollment.backupCodes.length,
      landsOnTheMemberHome,
      listsTheThreadOpenedEarlier: board.listsTheThreadAfterwards,
      opensEveryListedSettingsItem: settings.opensEveryListedItem,
      reachesLeaveInOneClick: settings.reachesLeaveInOneClick,
      reachesPlanInOneClick: settings.reachesPlanInOneClick,
      showsTheBiographyWrittenEarlier,
      showsTheReplyOnTheThread: board.showsTheReply,
    };
  });

const operatorHome = (reported: {
  readonly email: string;
  readonly operatorOrigin: string;
  readonly page: Page;
}): Effect.Effect<
  { readonly landsOnTheOperatorOrigin: boolean; readonly listsTheOperatorsOwnAddress: boolean },
  JourneyFailure
> =>
  Effect.gen(function* confirmOperatorHome() {
    yield* seeHeading(reported.page, "利用者の一覧");
    yield* seeText(reported.page, reported.email);
    const listsTheOperatorsOwnAddress = yield* pageStep(() =>
      reported.page.getByText(reported.email, { exact: false }).first().isVisible(),
    );
    return {
      landsOnTheOperatorOrigin: new URL(reported.page.url()).origin === reported.operatorOrigin,
      listsTheOperatorsOwnAddress,
    };
  });

const runOperatorJourney = (
  stage: JourneyStage,
): Effect.Effect<
  { readonly landsOnTheOperatorOrigin: boolean; readonly listsTheOperatorsOwnAddress: boolean },
  JourneyFailure,
  Crypto.Crypto
> =>
  Effect.gen(function* walkOperatorJourney() {
    const { environment, page } = stage;
    const { account, origin } = yield* signUpAndConfirm(stage, "operator");
    const enrollment = yield* enrollTotp({ account, origin, page });
    yield* environment.promoteToAdministrator(account.email);
    const operatorOrigin = environment.originOf("operator");
    yield* signIn({ account, origin: operatorOrigin, page });
    yield* answerTotpChallenge(page, enrollment.uri);
    return yield* operatorHome({ email: account.email, operatorOrigin, page });
  });

const readDocument = (stage: JourneyStage, url: string): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* openDocument() {
    yield* pageStep(() => stage.page.goto(url));
    yield* seeAnyHeading(stage.page);
  });

const runDocumentJourney = (
  stage: JourneyStage,
): Effect.Effect<
  {
    readonly documentsRead: number;
    readonly loginPath: string;
    readonly showsTheAddressField: boolean;
  },
  JourneyFailure
> =>
  Effect.gen(function* walkDocumentJourney() {
    const { environment, page } = stage;
    const origin = environment.originOf("knowledge");
    const [firstDocument = "", secondDocument = ""] = environment.documents;
    yield* readDocument(stage, `${origin}${firstDocument}`);
    yield* readDocument(stage, `${origin}${secondDocument}`);
    yield* pageStep(() => page.goto(`${origin}/login`));
    const address = page.getByLabel("メールアドレス", { exact: true }).first();
    yield* pageStep(() => address.waitFor({ state: "visible", timeout: appearanceTimeout }));
    const showsTheAddressField = yield* pageStep(() => address.isVisible());
    return {
      documentsRead: [firstDocument, secondDocument].filter((documentPath) => documentPath !== "")
        .length,
      loginPath: new URL(page.url()).pathname,
      showsTheAddressField,
    };
  });

const assertVerifyMemberObservability = (verified: {
  readonly requestIds: readonly string[];
  readonly sessionToken: string | undefined;
  readonly userId: string | undefined;
}): Effect.Effect<void, JourneyFailure> => {
  if (verified.requestIds.length === 0) {
    return Effect.fail(failed("VERIFY_OBSERVABILITY_MISSING"));
  }
  if (verified.sessionToken === undefined || verified.userId === undefined) {
    return Effect.fail(failed("VERIFY_SESSION_MISSING"));
  }
  return Effect.void;
};

const runVerifyMemberJourney = (
  stage: JourneyStage,
): Effect.Effect<
  {
    readonly browserUserAgent: string;
    readonly enrolledTotp: true;
    readonly observabilityRecorded: true;
    readonly passkeyRegistered: true;
    readonly sessionEstablished: true;
    readonly userAgent: string;
  },
  JourneyFailure,
  Crypto.Crypto
> =>
  Effect.gen(function* verifyMemberThroughApps() {
    const origin = stage.environment.originOf("member");
    const verified = yield* runVerifyMember({
      mail: stage.environment.mail,
      origin,
      page: stage.page,
    });
    yield* assertVerifyMemberObservability(verified);
    return {
      browserUserAgent: agentUserAgent,
      enrolledTotp: true as const,
      observabilityRecorded: true as const,
      passkeyRegistered: true as const,
      sessionEstablished: true as const,
      userAgent: agentUserAgent,
    };
  });

export { runDocumentJourney, runMemberJourney, runOperatorJourney, runVerifyMemberJourney };
