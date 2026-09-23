import {
  FieldValidationMessageContext,
  type FieldValidationMessages,
} from "./field-validation-messages";

import type { ReactElement } from "react";
import type { Children } from "./types";

const FieldValidationMessageProvider = ({
  children,
  messages: validationMessages,
}: Children & Readonly<{ messages: FieldValidationMessages }>): ReactElement => {
  return (
    <FieldValidationMessageContext value={validationMessages}>
      {children}
    </FieldValidationMessageContext>
  );
};

export { FieldValidationMessageProvider };
