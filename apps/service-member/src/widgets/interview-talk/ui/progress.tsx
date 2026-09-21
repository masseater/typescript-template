import { InterviewSheet } from "./sheet.tsx";

import type { ReactElement } from "react";
import type { FieldViewData } from "../model/view.ts";

function InterviewProgress({
  fields,
}: Readonly<{ fields: readonly FieldViewData[] }>): ReactElement {
  const settled = fields.filter((field) => field.status !== "unanswered").length;
  return (
    <details className="text-sm text-muted-foreground md:pointer-events-none">
      <summary>{`${settled} / ${fields.length} 項目`}</summary>
      <InterviewSheet fields={fields} />
    </details>
  );
}

export { InterviewProgress };
