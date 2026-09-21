import type { ReactElement } from "react";
import type { FieldViewData } from "../model/view.ts";

const emptyText = { skipped: "スキップ", unanswered: "未回答" } as const;

function InterviewSheetField({ field }: Readonly<{ field: FieldViewData }>): ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border py-1.5">
      <dt className="shrink-0 text-sm text-muted-foreground">{field.label}</dt>
      {field.status === "answered" ? (
        <dd className="text-right text-sm text-foreground">{field.value}</dd>
      ) : (
        <dd className="text-right text-sm text-muted-foreground">{emptyText[field.status]}</dd>
      )}
    </div>
  );
}

export { InterviewSheetField };
