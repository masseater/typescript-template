import { apiData } from "@repo/runtime/client";

import { Blocked, ReportFiled } from "#shared/contracts/index.ts";
import { userClient } from "./client.ts";

import type { ReportReason, ReportSubject } from "@repo/config";

function blockMember(memberId: string): Promise<void> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.trust.block.put({ memberId }).then((response) => {
      apiData(Blocked, response);
    }),
  );
}

function unblockMember(memberId: string): Promise<void> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.trust.block.delete({ memberId }).then((response) => {
      apiData(Blocked, response);
    }),
  );
}

function fileReport(
  subjectKind: ReportSubject,
  subjectId: string,
  reason: ReportReason,
): Promise<void> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.trust.report.post({ reason, subjectId, subjectKind }).then((response) => {
      apiData(ReportFiled, response);
    }),
  );
}

export { blockMember, fileReport, unblockMember };
