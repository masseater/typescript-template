import { FIELD_STATUS, type InterviewViewData } from "#shared/interview/index.ts";
import type { ReactElement } from "react";

type FieldView = InterviewViewData["fields"][number];

function fieldText(field: FieldView): string {
  if (field.status === FIELD_STATUS.answered && field.value !== undefined) {
    return field.value;
  }
  return field.status === FIELD_STATUS.skipped ? "スキップ" : "未回答";
}

function InterviewSheetField({ field }: Readonly<{ field: FieldView }>): ReactElement {
  const muted = field.status !== FIELD_STATUS.answered || field.value === undefined;
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border py-1">
      <dt className="shrink-0 text-sm text-muted-foreground">{field.label}</dt>
      <dd className={muted ? "text-right text-sm text-muted-foreground" : "text-right text-sm"}>
        {fieldText(field)}
      </dd>
    </div>
  );
}

function InterviewSheet({ fields }: Readonly<{ fields: readonly FieldView[] }>): ReactElement {
  return (
    <dl className="flex flex-col">
      {fields.map((field) => (
        <InterviewSheetField key={field.key} field={field} />
      ))}
    </dl>
  );
}

export { InterviewSheet };
export type { FieldView };
