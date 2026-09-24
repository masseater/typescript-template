import { reportReasons, reportSubjects } from "@repo/config";
import { Acknowledged, CreatedResource } from "@repo/runtime/contracts";
import { Schema } from "effect";

import { Identifier } from "./member.ts";

const BlockMember = Schema.Struct({ memberId: Identifier });
const Blocked = Acknowledged;

const ReportCreate = Schema.Struct({
  reason: Schema.Literals(reportReasons),
  subjectId: Identifier,
  subjectKind: Schema.Literals(reportSubjects),
});

const ReportFiled = CreatedResource;

export { Blocked, BlockMember, ReportCreate, ReportFiled };
