import { APPLICATION, ROLE } from "@repo/config";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { staffInquiryCounts } from "./inquiry-staff.ts";
import {
  closeInquiry,
  countPendingInquiries,
  createMemberInquiry,
  getMemberInquiry,
  listMemberInquiries,
  replyAsAdmin,
} from "./inquiry.ts";
import { addSession, addUser, auditActionsOf } from "./records-fixture.ts";
import { INQUIRY_STATUS } from "./schema.ts";
import { TestDatabase } from "./testing.ts";

describe("listMemberInquiries", () => {
  const it = test.extend("listedSubjects", () =>
    Effect.runPromise(
      Effect.gen(function* listOwnInquiries() {
        yield* addUser({ userId: "owner" });
        yield* addUser({ userId: "other" });
        yield* createMemberInquiry("owner", { body: "本文", subject: "件名" });
        yield* createMemberInquiry("other", { body: "他人", subject: "他人の件名" });
        const listed = yield* listMemberInquiries("owner");
        return listed.map((listedInquiry) => listedInquiry.subject);
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("lists only the member's own inquiries", ({ listedSubjects }) => {
    expect(listedSubjects).toStrictEqual(["件名"]);
  });
});

describe("getMemberInquiry", () => {
  const it = test.extend("intruderFailureTag", () =>
    Effect.runPromise(
      Effect.gen(function* readAsIntruder() {
        yield* addUser({ userId: "owner" });
        yield* addUser({ userId: "intruder" });
        const ownerInquiry = yield* createMemberInquiry("owner", {
          body: "本文",
          subject: "件名",
        });
        const refused = yield* getMemberInquiry("intruder", ownerInquiry.id).pipe(Effect.flip);
        return refused._tag;
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("rejects another member from reading an inquiry", ({ intruderFailureTag }) => {
    expect(intruderFailureTag).toBe("InquiryNotFound");
  });
});

describe("replyAsAdmin", () => {
  const it = test.extend("adminReply", () =>
    Effect.runPromise(
      Effect.gen(function* replyToMember() {
        yield* addUser({ role: ROLE.administrator, userId: "admin" });
        yield* addUser({ userId: "member" });
        const sessionId = yield* addSession({ audience: APPLICATION.admin, userId: "admin" });
        const memberInquiry = yield* createMemberInquiry("member", {
          body: "本文",
          subject: "件名",
        });
        const replied = yield* replyAsAdmin({
          body: "返信です",
          inquiryId: memberInquiry.id,
          sessionId,
        });
        const auditTrail = yield* auditActionsOf(memberInquiry.id);
        return {
          auditActions: auditTrail.map((auditEntry) => auditEntry.action),
          repliedStatus: replied.status,
        };
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("marks an inquiry answered and writes an audit event", ({ adminReply }) => {
    expect(adminReply).toStrictEqual({
      auditActions: ["inquiry_replied"],
      repliedStatus: INQUIRY_STATUS.answered,
    });
  });
});

describe("staffInquiryCounts", () => {
  const it = test.extend("inquiryTally", () =>
    Effect.runPromise(
      Effect.gen(function* tallyInquiries() {
        yield* addUser({ userId: "member" });
        const answered = yield* createMemberInquiry("member", { body: "本文", subject: "件名" });
        yield* addUser({ role: ROLE.administrator, userId: "admin" });
        const sessionId = yield* addSession({ audience: APPLICATION.admin, userId: "admin" });
        yield* replyAsAdmin({ body: "返信です", inquiryId: answered.id, sessionId });
        yield* createMemberInquiry("member", { body: "2件目", subject: "2件目" });
        const closed = yield* createMemberInquiry("member", { body: "3件目", subject: "3件目" });
        yield* closeInquiry(sessionId, closed.id);
        const inquiryCounts = yield* staffInquiryCounts();
        const pending = yield* countPendingInquiries(sessionId);
        return {
          byStatus: inquiryCounts.byStatus,
          pending,
          trendRecorded: inquiryCounts.trend.length >= 1,
        };
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("aggregates inquiry counts by status and day", ({ inquiryTally }) => {
    expect(inquiryTally).toStrictEqual({
      byStatus: {
        [INQUIRY_STATUS.answered]: 1,
        [INQUIRY_STATUS.closed]: 1,
        [INQUIRY_STATUS.open]: 1,
      },
      pending: 1,
      trendRecorded: true,
    });
  });
});
