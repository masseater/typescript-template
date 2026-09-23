import { Checkbox as BaseCheckbox, type CheckboxOverrides } from "baseui/checkbox";

import type { ReactElement } from "react";

const checkboxOverrides = {
  Root: {
    props: {
      "data-slot": "checkbox",
    },
    style: {
      display: "inline-flex",
      height: "24px",
      minHeight: "24px",
      minWidth: "24px",
      position: "relative",
      width: "24px",
    },
  },
  Checkmark: {
    style: {
      height: "24px",
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      marginTop: 0,
      width: "24px",
    },
  },
  Input: {
    style: {
      cursor: "pointer",
      height: "24px",
      left: 0,
      margin: 0,
      opacity: 0.01,
      overflow: "hidden",
      padding: 0,
      position: "absolute",
      top: 0,
      width: "24px",
    },
  },
} as const satisfies CheckboxOverrides;

const Checkbox = ({
  "aria-label": ariaLabel,
  checked,
  disabled = false,
  name,
  onCheckedChange,
}: Readonly<{
  "aria-label": string;
  checked: boolean;
  disabled?: boolean;
  name?: string | undefined;
  onCheckedChange: (checked: boolean) => void;
}>): ReactElement => {
  if (name === undefined) {
    return (
      <BaseCheckbox
        aria-label={ariaLabel}
        checked={checked}
        disabled={disabled}
        overrides={checkboxOverrides}
        onChange={(change) => {
          onCheckedChange(change.currentTarget.checked);
        }}
      />
    );
  }
  return (
    <BaseCheckbox
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      name={name}
      overrides={checkboxOverrides}
      onChange={(change) => {
        onCheckedChange(change.currentTarget.checked);
      }}
    />
  );
};

export { Checkbox };
