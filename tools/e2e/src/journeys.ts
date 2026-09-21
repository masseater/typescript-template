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
import {
  appearanceTimeout,
  fill,
  press,
  readyButton,
  seeAnyHeading,
  seeHeading,
  seeText,
} from "./screens.ts";
import { runVerifyMember } from "./verify-member.ts";

import type { Page } from "playwright";
import type { JourneyEnvironment } from "./environment.ts";

type JourneyStage = {
  readonly environment: JourneyEnvironment;
  readonly page: Page;
};

const completeWelcomeOnboarding = async (
  stage: JourneyStage,
  visit: { readonly account: Account; readonly origin: string },
): Promise<void> => {
  const { page } = stage;
  await page.waitForURL((url) => url.pathname.includes("/welcome"), { timeout: appearanceTimeout });
  await seeHeading(page, "規約への同意");
  await press(page, "同意して続ける");
  await seeHeading(page, "プロフィールの作り方");
  await press(page, "自分で入力する");
  await seeHeading(page, "基本項目の入力");
  await fill(page, { fieldLabel: "ユーザー名", typed: visit.account.name });
  await Promise.all([
    page.waitForURL(`${visit.origin}${homePattern}`, { timeout: appearanceTimeout }),
    press(page, "保存してホームへ"),
  ]);
};

const signUpAndConfirm = async (
  stage: JourneyStage,
  role: "member" | "operator",
): Promise<{ readonly account: Account; readonly origin: string }> => {
  const origin = stage.environment.originOf("member");
  const account = newAccount(role);
  await signUp({ account, origin, page: stage.page });
  await seeHeading(stage.page, "確認メールを送りました");
  await confirmEmail({ account, mail: stage.environment.mail, origin, page: stage.page });
  await signIn({ account, origin, page: stage.page });
  await completeWelcomeOnboarding(stage, { account, origin });
  return { account, origin };
};

const openMainNav = async (
  stage: JourneyStage,
  destination: Readonly<{ heading: string; linkName: string }>,
): Promise<void> => {
  await stage.page.getByRole("link", { exact: true, name: destination.linkName }).first().click();
  await seeHeading(stage.page, destination.heading);
};

const browseMainScreens = async (stage: JourneyStage, account: Account): Promise<void> => {
  const origin = stage.environment.originOf("member");
  await seeHeading(stage.page, "ホーム");
  await openMainNav(stage, { heading: account.name, linkName: "プロフィール" });
  await openMainNav(stage, { heading: "掲示板", linkName: "掲示板" });
  await openMainNav(stage, { heading: "ホーム", linkName: "ホーム" });
  await stage.page.goto(`${origin}/users`);
  await stage.page.waitForURL(`${origin}/upgrade`, { timeout: appearanceTimeout });
  await seeHeading(stage.page, "有料プラン");
};

const writeBiography = async (
  stage: JourneyStage,
  origin: string,
): Promise<{ readonly biography: string; readonly profilePath: string }> => {
  const biography = `journey ${crypto.randomUUID()}`;
  await stage.page.goto(`${origin}/settings/profile`);
  await seeHeading(stage.page, "プロフィールの編集");
  await readyButton(stage.page, "保存");
  await fill(stage.page, { fieldLabel: "自己紹介", typed: biography });
  await press(stage.page, "保存");
  await stage.page.waitForURL(`${origin}/users/*`, { timeout: appearanceTimeout });
  await seeText(stage.page, biography);
  return { biography, profilePath: new URL(stage.page.url()).pathname };
};

type ListedSetting = { readonly heading: string; readonly name: string };

const openListedSetting = async (
  stage: JourneyStage,
  visit: { readonly listedSetting: ListedSetting; readonly origin: string },
): Promise<void> => {
  await stage.page.goto(`${visit.origin}/settings`);
  await seeHeading(stage.page, "設定");
  await stage.page
    .getByRole("list")
    .getByRole("link", { exact: true, name: visit.listedSetting.name })
    .click();
  await seeHeading(stage.page, visit.listedSetting.heading);
};

const browseSettings = async (
  stage: JourneyStage,
  origin: string,
): Promise<{
  readonly opensEveryListedItem: boolean;
  readonly reachesLeaveInOneClick: boolean;
  readonly reachesPlanInOneClick: boolean;
}> => {
  await openListedSetting(stage, {
    listedSetting: { heading: "プランと解約", name: "プランと解約" },
    origin,
  });
  const reachesPlanInOneClick = stage.page.url().startsWith(`${origin}/settings/plan`);
  await openListedSetting(stage, { listedSetting: { heading: "退会", name: "退会" }, origin });
  const reachesLeaveInOneClick = stage.page.url().startsWith(`${origin}/settings/leave`);
  const listedSettings = [
    { heading: "プロフィールの編集", name: "プロフィール" },
    { heading: "通知", name: "通知" },
    { heading: "セキュリティ", name: "セキュリティ" },
    { heading: "AI インタビュー", name: "AI インタビュー" },
    { heading: "AI と API", name: "AI と API" },
    { heading: "プランと解約", name: "プランと解約" },
    { heading: "退会", name: "退会" },
  ] as const satisfies readonly ListedSetting[];
  for (const listedSetting of listedSettings) {
    await openListedSetting(stage, { listedSetting, origin });
  }
  return {
    opensEveryListedItem: true,
    reachesLeaveInOneClick,
    reachesPlanInOneClick,
  };
};

const signInAgainWithTotp = async (
  stage: JourneyStage,
  enrolled: { readonly account: Account; readonly origin: string; readonly uri: string },
): Promise<void> => {
  await signOut(stage.page, enrolled.origin);
  await signIn({ account: enrolled.account, origin: enrolled.origin, page: stage.page });
  await answerTotpChallenge(stage.page, enrolled.uri);
  await stage.page.waitForURL(`${enrolled.origin}${homePattern}`, { timeout: appearanceTimeout });
};

const runMemberJourney = async (
  stage: JourneyStage,
): Promise<{
  readonly backupCodeCount: number;
  readonly landsOnTheMemberHome: boolean;
  readonly opensEveryListedSettingsItem: boolean;
  readonly reachesLeaveInOneClick: boolean;
  readonly reachesPlanInOneClick: boolean;
  readonly showsTheBiographyWrittenEarlier: boolean;
}> => {
  const { account, origin } = await signUpAndConfirm(stage, "member");
  await browseMainScreens(stage, account);
  const settings = await browseSettings(stage, origin);
  const { biography, profilePath } = await writeBiography(stage, origin);
  const enrollment = await enrollTotp({ account, origin, page: stage.page });
  await signInAgainWithTotp(stage, { account, origin, uri: enrollment.uri });
  const landsOnTheMemberHome = stage.page.url().startsWith(`${origin}/home`);
  await stage.page.goto(`${origin}${profilePath}`);
  await seeText(stage.page, biography);
  return {
    backupCodeCount: enrollment.backupCodes.length,
    landsOnTheMemberHome,
    opensEveryListedSettingsItem: settings.opensEveryListedItem,
    reachesLeaveInOneClick: settings.reachesLeaveInOneClick,
    reachesPlanInOneClick: settings.reachesPlanInOneClick,
    showsTheBiographyWrittenEarlier: await stage.page
      .getByText(biography, { exact: false })
      .first()
      .isVisible(),
  };
};

const runOperatorJourney = async (
  stage: JourneyStage,
): Promise<{
  readonly landsOnTheOperatorOrigin: boolean;
  readonly listsTheOperatorsOwnAddress: boolean;
}> => {
  const { environment, page } = stage;
  const { account, origin } = await signUpAndConfirm(stage, "operator");
  const enrollment = await enrollTotp({ account, origin, page });
  await environment.promoteToAdministrator(account.email);
  const operatorOrigin = environment.originOf("operator");
  await signIn({ account, origin: operatorOrigin, page });
  await answerTotpChallenge(page, enrollment.uri);
  await seeHeading(page, "利用者の一覧");
  await seeText(page, account.email);
  return {
    landsOnTheOperatorOrigin: new URL(page.url()).origin === operatorOrigin,
    listsTheOperatorsOwnAddress: await page
      .getByText(account.email, { exact: false })
      .first()
      .isVisible(),
  };
};

const readDocument = async (stage: JourneyStage, url: string): Promise<void> => {
  await stage.page.goto(url);
  await seeAnyHeading(stage.page);
};

const runDocumentJourney = async (
  stage: JourneyStage,
): Promise<{
  readonly documentsRead: number;
  readonly loginPath: string;
  readonly showsTheAddressField: boolean;
}> => {
  const { environment, page } = stage;
  const origin = environment.originOf("knowledge");
  const [firstDocument = "", secondDocument = ""] = environment.documents;
  await readDocument(stage, `${origin}${firstDocument}`);
  await readDocument(stage, `${origin}${secondDocument}`);
  await page.goto(`${origin}/login`);
  const address = page.getByLabel("メールアドレス", { exact: true }).first();
  await address.waitFor({ state: "visible", timeout: appearanceTimeout });
  return {
    documentsRead: [firstDocument, secondDocument].filter((path) => path !== "").length,
    loginPath: new URL(page.url()).pathname,
    showsTheAddressField: await address.isVisible(),
  };
};

const assertVerifyMemberObservability = (verified: {
  readonly requestIds: readonly string[];
  readonly sessionToken: string | undefined;
  readonly userId: string | undefined;
}): void => {
  if (verified.requestIds.length === 0) {
    throw new Error("VERIFY_OBSERVABILITY_MISSING");
  }
  if (verified.sessionToken === undefined || verified.userId === undefined) {
    throw new Error("VERIFY_SESSION_MISSING");
  }
};

const runVerifyMemberJourney = async (
  stage: JourneyStage,
): Promise<{
  readonly browserUserAgent: string;
  readonly enrolledTotp: true;
  readonly observabilityRecorded: true;
  readonly passkeyRegistered: true;
  readonly sessionEstablished: true;
  readonly userAgent: string;
}> => {
  const origin = stage.environment.originOf("member");
  const verified = await runVerifyMember({
    mail: stage.environment.mail,
    origin,
    page: stage.page,
  });
  assertVerifyMemberObservability(verified);
  return {
    browserUserAgent: agentUserAgent,
    enrolledTotp: true,
    observabilityRecorded: true,
    passkeyRegistered: true,
    sessionEstablished: true,
    userAgent: agentUserAgent,
  };
};

export { runDocumentJourney, runMemberJourney, runOperatorJourney, runVerifyMemberJourney };
