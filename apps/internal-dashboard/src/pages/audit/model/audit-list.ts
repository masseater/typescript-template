import { useAtomValue } from "@effect/atom-react";
import { auditActions } from "@repo/db/dashboard-literals";
import { localState, requestAtom, type RequestResult } from "@repo/ui";
import { Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";

import { loadAuditPage } from "#pages/audit/api/audit.ts";

import type { AuditPageQuery, StaffAuditPageView } from "#shared/contracts/index.ts";
import type { SubmitEventHandler } from "react";

interface AuditFilter {
  readonly action: string;
  readonly actorId: string;
  readonly targetId: string;
}

interface AuditList extends AuditFilter {
  readonly handleActionChange: (action: string) => void;
  readonly handleActorIdChange: (actorId: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly handleTargetIdChange: (targetId: string) => void;
  readonly listing: RequestResult<StaffAuditPageView>;
}

const auditPageSize = 50;
const AuditAction = Schema.Literals(auditActions);

const emptyFilter: AuditFilter = { action: "", actorId: "", targetId: "" };

function auditPageQuery(filter: AuditFilter): typeof AuditPageQuery.Type {
  return {
    ...(Schema.is(AuditAction)(filter.action) ? { action: filter.action } : {}),
    ...(filter.actorId.length > 0 ? { actorId: filter.actorId } : {}),
    limit: auditPageSize,
    offset: 0,
    ...(filter.targetId.length > 0 ? { targetId: filter.targetId } : {}),
  };
}

const auditPageAtom = Atom.family((filter: AuditFilter) =>
  requestAtom(async () => loadAuditPage(auditPageQuery(filter))),
);

const useDraftFilter = localState<AuditFilter>(emptyFilter);
const useAppliedFilter = localState<AuditFilter>(emptyFilter);

function useAuditList(): AuditList {
  const [draft, setDraft] = useDraftFilter();
  const [applied, setApplied] = useAppliedFilter();
  const listing = useAtomValue(auditPageAtom(applied));
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    setApplied(draft);
  }
  function handleActionChange(action: string): void {
    setDraft((current) => ({ ...current, action }));
  }
  function handleActorIdChange(actorId: string): void {
    setDraft((current) => ({ ...current, actorId }));
  }
  function handleTargetIdChange(targetId: string): void {
    setDraft((current) => ({ ...current, targetId }));
  }
  return {
    ...draft,
    handleActionChange,
    handleActorIdChange,
    handleSubmit,
    handleTargetIdChange,
    listing,
  };
}

export { useAuditList };
