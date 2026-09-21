import { describe, expect } from "vite-plus/test";

import { journeyTest } from "./journey-browser.ts";
import { journeyRoles } from "./journey-roles.ts";
import {
  runDocumentJourney,
  runMemberJourney,
  runOperatorJourney,
  runVerifyMemberJourney,
} from "./journeys.ts";

const backupCodesIssuedOnEnrollment = 10;
const documentsReadByAnyone = 2;
const robotsDirective = "noindex, nofollow";
const aiAgentUserAgent = "Mozilla/5.0 (compatible; Cursor/1.0) AI-Agent/playwright";

describe("アプリ全体の導線", () => {
  const it = journeyTest
    .extend("memberJourney", async ({ environment, page }) =>
      runMemberJourney({ environment, page }),
    )
    .extend("operatorJourney", async ({ environment, page }) =>
      runOperatorJourney({ environment, page }),
    )
    .extend("documentJourney", async ({ environment, page }) =>
      runDocumentJourney({ environment, page }),
    )
    .extend("verifyMemberJourney", async ({ environment, page }) =>
      runVerifyMemberJourney({ environment, page }),
    )
    .extend("robotsTags", async ({ environment, page }) =>
      Promise.all(
        journeyRoles.map(async (role) => {
          const originReply = await page.request.get(environment.originOf(role));
          return originReply.headers()["x-robots-tag"];
        }),
      ),
    );

  it("利用者は登録から確認メール・ログイン・プロフィール更新・二要素まで辿れる", ({
    memberJourney,
  }) => {
    expect(memberJourney).toStrictEqual({
      backupCodeCount: backupCodesIssuedOnEnrollment,
      landsOnTheMemberHome: true,
      opensEveryListedSettingsItem: true,
      reachesLeaveInOneClick: true,
      reachesPlanInOneClick: true,
      showsTheBiographyWrittenEarlier: true,
    });
  });

  it("管理者は二要素を済ませた上で利用者一覧を開ける", ({ operatorJourney }) => {
    expect(operatorJourney).toStrictEqual({
      landsOnTheOperatorOrigin: true,
      listsTheOperatorsOwnAddress: true,
    });
  });

  it("誰でも読める資料は複数ページと認証画面を配る", ({ documentJourney }) => {
    expect(documentJourney).toStrictEqual({
      documentsRead: documentsReadByAnyone,
      loginPath: "/login",
      showsTheAddressField: true,
    });
  });

  it("どのアプリも検索エンジンの索引に載らない", ({ robotsTags }) => {
    expect(robotsTags).toStrictEqual(journeyRoles.map(() => robotsDirective));
  });

  it("AI エージェントは会員登録からパスキー・TOTP まで通し、識別可能な User-Agent を送る", ({
    verifyMemberJourney,
  }) => {
    expect(verifyMemberJourney).toStrictEqual({
      browserUserAgent: aiAgentUserAgent,
      enrolledTotp: true,
      observabilityRecorded: true,
      passkeyRegistered: true,
      sessionEstablished: true,
      userAgent: aiAgentUserAgent,
    });
  });
});
