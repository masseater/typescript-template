import { reportReasons, reportSubjects } from "@repo/config";
import { Identifier } from "@repo/config/paging";
import { Schema } from "effect";

const BlockMember = Schema.Struct({ memberId: Identifier });
const Blocked = Schema.Struct({ ok: Schema.Literal(true) });

const ReportCreate = Schema.Struct({
  reason: Schema.Literals(reportReasons),
  subjectId: Identifier,
  subjectKind: Schema.Literals(reportSubjects),
});

const ReportFiled = Schema.Struct({ id: Schema.String });

export { Blocked, BlockMember, ReportCreate, ReportFiled };
