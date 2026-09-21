import { apiData } from "@repo/runtime/client";

import { Blocked, ReportFiled } from "#shared/contracts/index.ts";
import { userClient } from "./client.ts";

import type { ReportReason, ReportSubject } from "@repo/config";

async function blockMember(memberId: string): Promise<void> {
  const { api } = await userClient();
  apiData(Blocked, await api.trust.block.put({ memberId }));
}

async function unblockMember(memberId: string): Promise<void> {
  const { api } = await userClient();
  apiData(Blocked, await api.trust.block.delete({ memberId }));
}

async function fileReport(
  subjectKind: ReportSubject,
  subjectId: string,
  reason: ReportReason,
): Promise<void> {
  const { api } = await userClient();
  apiData(ReportFiled, await api.trust.report.post({ reason, subjectId, subjectKind }));
}

export { blockMember, fileReport, unblockMember };
