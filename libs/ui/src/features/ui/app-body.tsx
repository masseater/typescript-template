import { Scripts } from "@tanstack/react-router";

import { AppProviders } from "./app-providers";

import type { ReactElement } from "react";
import type { FieldValidationMessages } from "./shared/ui/field-validation-messages";
import type { Children } from "./shared/ui/types";

const AppBody = ({
  children,
  fieldValidationMessages,
}: Children & Readonly<{ fieldValidationMessages: FieldValidationMessages }>): ReactElement => (
  <body>
    <AppProviders fieldValidationMessages={fieldValidationMessages}>{children}</AppProviders>
    <Scripts />
  </body>
);

export { AppBody };
