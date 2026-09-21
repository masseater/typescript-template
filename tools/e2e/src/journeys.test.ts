import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import { journeyTest } from "./journey-browser.ts";
import { journeyRoles } from "./journey-roles.ts";
import {
  runDocumentJourney,
  runMemberJourney,
  runOperatorJourney,
  runVerifyMemberJourney,
} from "./journeys.ts";
import { pageStep } from "./screens.ts";

const backupCodesIssuedOnEnrollment = 10;
const documentsReadByAnyone = 2;
const robotsDirective = "noindex, nofollow";
const aiAgentUserAgent = "Mozilla/5.0 (compatible; Cursor/1.0) AI-Agent/playwright";

describe("アプリ全体の導線", () => {
  const it = journeyTest
    .extend("memberJourney", ({ environment, page }) =>
      Effect.runPromise(
        runMemberJourney({ environment, page }).pipe(Effect.provide(NodeServices.layer)),
      ),
    )
    .extend("operatorJourney", ({ environment, page }) =>
      Effect.runPromise(
        runOperatorJourney({ environment, page }).pipe(Effect.provide(NodeServices.layer)),
      ),
    )
    .extend("documentJourney", ({ environment, page }) =>
      Effect.runPromise(runDocumentJourney({ environment, page })),
    )
    .extend("verifyMemberJourney", async ({ environment, page }) =>
      runVerifyMemberJourney({ environment, page }),
    )
    .extend("robotsTags", ({ environment, page }) =>
      Effect.runPromise(
        Effect.forEach(
          journeyRoles,
          (role) =>
            pageStep(() => page.request.get(environment.originOf(role))).pipe(
              Effect.map((originReply) => originReply.headers()["x-robots-tag"]),
            ),
          { concurrency: "unbounded" },
        ),
      ),
    );

  it("利用者は登録から確認メール・ログイン・掲示板・プロフィール更新・二要素まで辿れる", ({
    memberJourney,
  }) => {
    expect(memberJourney).toStrictEqual({
      backupCodeCount: backupCodesIssuedOnEnrollment,
      landsOnTheMemberHome: true,
      listsTheThreadOpenedEarlier: true,
      opensEveryListedSettingsItem: true,
      reachesLeaveInOneClick: true,
      reachesPlanInOneClick: true,
      showsTheBiographyWrittenEarlier: true,
      showsTheReplyOnTheThread: true,
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
