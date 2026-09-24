import { FormControl } from "baseui/form-control";
import {
  type ChangeEventHandler,
  type ComponentProps,
  type FocusEventHandler,
  type ReactElement,
} from "react";

import { localState } from "../../local-state";
import { controlClassName, errorClassName, fieldClassName, labelClassName } from "./control";
import {
  fieldValidationMessageKinds,
  useFieldValidationMessages,
} from "./field-validation-messages";

const useConstraintMessage = localState<string | undefined>(undefined);

const messageForValidity = (
  validity: globalThis.ValidityState,
  validationMessages: ReturnType<typeof useFieldValidationMessages>,
): string | undefined => {
  for (const constraint of fieldValidationMessageKinds) {
    if (validity[constraint]) {
      return validationMessages[constraint];
    }
  }
  return undefined;
};

const errorText = (
  reportedMessage: string | undefined,
  constraintMessage: string | undefined,
): ReactElement | null => {
  const shownError = reportedMessage ?? constraintMessage;
  return shownError === undefined ? null : <span className={errorClassName}>{shownError}</span>;
};

const Field = ({
  autoComplete,
  error,
  inputMode,
  label,
  maxLength,
  minLength,
  multiline,
  name,
  onBlur,
  onValueChange,
  pattern,
  readOnly,
  required,
  type,
  value,
}: Readonly<
  Pick<
    ComponentProps<"input">,
    "inputMode" | "maxLength" | "minLength" | "name" | "readOnly" | "required" | "value"
  > & {
    autoComplete?:
      | "current-password"
      | "name"
      | "new-password"
      | "off"
      | "one-time-code"
      | "username";
    error?: string | undefined;
    label: string;
    onBlur?: () => void;
    onValueChange?: (nextValue: string) => void;
  }
> &
  Readonly<
    | { multiline: true; pattern?: never; type?: never }
    | { multiline?: false; pattern?: string; type?: "email" | "password" | "search" | "text" }
  >): ReactElement => {
  const validationMessages = useFieldValidationMessages();
  const [constraintMessage, setConstraintMessage] = useConstraintMessage();
  const handleBlur: FocusEventHandler<HTMLInputElement | HTMLTextAreaElement> = (blur) => {
    setConstraintMessage(messageForValidity(blur.currentTarget.validity, validationMessages));
    onBlur?.();
  };
  const handleChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> = (change) => {
    onValueChange?.(change.currentTarget.value);
  };
  const control =
    multiline === true ? (
      <textarea
        aria-label={label}
        name={name}
        value={value}
        readOnly={readOnly}
        required={required}
        maxLength={maxLength}
        minLength={minLength}
        className={`block field-sizing-content min-h-16 ${controlClassName}`}
        onBlur={handleBlur}
        onChange={handleChange}
      />
    ) : (
      <input
        aria-label={label}
        type={type}
        name={name}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        minLength={minLength}
        pattern={pattern}
        readOnly={readOnly}
        required={required}
        className={`inline-block leading-none ${controlClassName}`}
        onBlur={handleBlur}
        onChange={handleChange}
      />
    );
  return (
    <div data-slot="field" className={fieldClassName}>
      <FormControl
        label={<span className={labelClassName}>{label}</span>}
        error={errorText(error, constraintMessage)}
      >
        {control}
      </FormControl>
    </div>
  );
};

export { Field };
