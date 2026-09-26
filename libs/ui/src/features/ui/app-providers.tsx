import { RegistryProvider } from "@effect/atom-react";

import { BaseWebProvider } from "./baseweb-provider";
import { MotionProvider } from "./motion-provider";
import { FieldValidationMessageProvider } from "./shared/ui/field-validation-message-provider";
import { ToastProvider } from "./shared/ui/toast-provider";

import type { ReactElement } from "react";
import type { FieldValidationMessages } from "./shared/ui/field-validation-messages";
import type { Children } from "./shared/ui/types";

const AppProviders = ({
  children,
  fieldValidationMessages,
}: Children & Readonly<{ fieldValidationMessages: FieldValidationMessages }>): ReactElement => (
  <BaseWebProvider>
    <RegistryProvider>
      <MotionProvider>
        <FieldValidationMessageProvider messages={fieldValidationMessages}>
          <ToastProvider>{children}</ToastProvider>
        </FieldValidationMessageProvider>
      </MotionProvider>
    </RegistryProvider>
  </BaseWebProvider>
);

export { AppProviders };
