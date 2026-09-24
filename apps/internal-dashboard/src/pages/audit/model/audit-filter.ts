import type { SubmitEventHandler } from "react";

interface AuditFilter {
  readonly action: string;
  readonly actorId: string;
  readonly targetId: string;
}

interface AuditFilterForm extends AuditFilter {
  readonly handleActionChange: (action: string) => void;
  readonly handleActorIdChange: (actorId: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly handleTargetIdChange: (targetId: string) => void;
}

export type { AuditFilter, AuditFilterForm };
