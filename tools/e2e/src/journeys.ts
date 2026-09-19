import { type Account, newAccount } from "./accounts.ts";
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

import type { Page } from "playwright";
import type { JourneyEnvironment } from "./environment.ts";

type JourneyStage = {
  readonly environment: JourneyEnvironment;
  readonly page: Page;
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
  await stage.page.waitForURL(`${origin}${homePattern}`, { timeout: appearanceTimeout });
  return { account, origin };
};

const browseMainScreens = async (stage: JourneyStage, account: Account): Promise<void> => {
  const origin = stage.environment.originOf("member");
  await seeHeading(stage.page, account.name);
  await stage.page.goto(`${origin}/users`);
  await seeHeading(stage.page, "ユーザーを探す");
  await stage.page.getByRole("link", { exact: true, name: "ホーム" }).first().click();
  await seeHeading(stage.page, account.name);
};

const writeBiography = async (stage: JourneyStage, origin: string): Promise<string> => {
  const biography = `journey ${crypto.randomUUID()}`;
  await stage.page.goto(`${origin}/settings/profile`);
  await seeHeading(stage.page, "プロフィールの編集");
  await readyButton(stage.page, "保存");
  await fill(stage.page, { fieldLabel: "自己紹介", typed: biography });
  await press(stage.page, "保存");
  await stage.page.waitForURL(`${origin}${homePattern}`, { timeout: appearanceTimeout });
  await seeText(stage.page, biography);
  return biography;
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
  readonly showsTheBiographyWrittenEarlier: boolean;
}> => {
  const { account, origin } = await signUpAndConfirm(stage, "member");
  await browseMainScreens(stage, account);
  const biography = await writeBiography(stage, origin);
  const enrollment = await enrollTotp({ account, origin, page: stage.page });
  await signInAgainWithTotp(stage, { account, origin, uri: enrollment.uri });
  await seeText(stage.page, biography);
  return {
    backupCodeCount: enrollment.backupCodes.length,
    landsOnTheMemberHome: stage.page.url().startsWith(`${origin}/users/`),
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
  await seeHeading(page, "ユーザー一覧");
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

export { runDocumentJourney, runMemberJourney, runOperatorJourney };
