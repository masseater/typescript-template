import { InterviewSheetField } from "./sheet-field.tsx";

import type { ReactElement } from "react";
import type { FieldViewData } from "../model/view.ts";

function InterviewSheet({ fields }: Readonly<{ fields: readonly FieldViewData[] }>): ReactElement {
  return (
    <dl className="flex flex-col">
      {fields.map((field) => (
        <InterviewSheetField field={field} key={field.key} />
      ))}
    </dl>
  );
}

export { InterviewSheet };
