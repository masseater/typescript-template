import type { planReport } from "@repo/infra-cloudflare/operator";
import type { OperatorAccess } from "./access.ts";

const approvalSubject = (access: OperatorAccess): string =>
  `${access.repository} as ${access.principal}`;

const plannedEvent = (
  access: OperatorAccess,
  planned: Readonly<{ confirmation?: string; plan: ReturnType<typeof planReport> }>,
): Readonly<Record<string, unknown>> => ({
  ...planned,
  event: "github.planned",
  principal: access.principal,
  repository: access.repository,
});

export { approvalSubject, plannedEvent };
