import { FIELD_STATUS } from "#shared/interview/index.ts";
import { InterviewSheet } from "./sheet.tsx";

import type { ReactElement } from "react";
import type { FieldView } from "./sheet.tsx";

function InterviewProgress({ fields }: Readonly<{ fields: readonly FieldView[] }>): ReactElement {
  const settled = fields.filter((field) => field.status !== FIELD_STATUS.unanswered).length;
  return (
    <details className="text-sm text-muted-foreground md:pointer-events-none">
      <summary>{`${settled} / ${fields.length} 項目`}</summary>
      <InterviewSheet fields={fields} />
    </details>
  );
}

export { InterviewProgress };
