import { useStyletron } from "baseui";

import { useDropdownMenu } from "./dropdown-menu-context";

import type { ReactElement } from "react";
import type { Children } from "./types";

const DropdownMenuItem = ({
  children,
  disabled,
  onClick,
  variant = "default",
}: Children &
  Readonly<{
    disabled?: boolean;
    onClick: () => void;
    variant?: "default" | "destructive";
  }>): ReactElement => {
  const { close } = useDropdownMenu();
  const [css, theme] = useStyletron();
  return (
    <button
      type="button"
      role="menuitem"
      data-slot="dropdown-menu-item"
      disabled={disabled}
      className={css({
        backgroundColor: "transparent",
        border: "none",
        borderRadius: theme.borders.radius200,
        color: variant === "destructive" ? theme.colors.negative : theme.colors.contentPrimary,
        cursor: disabled === true ? "not-allowed" : "pointer",
        display: "block",
        fontSize: theme.typography.ParagraphMedium.fontSize,
        lineHeight: theme.typography.ParagraphMedium.lineHeight,
        paddingBottom: theme.sizing.scale300,
        paddingLeft: theme.sizing.scale300,
        paddingRight: theme.sizing.scale300,
        paddingTop: theme.sizing.scale300,
        textAlign: "left",
        width: "100%",
        ":hover":
          disabled === true
            ? {}
            : {
                backgroundColor: theme.colors.backgroundSecondary,
              },
      })}
      onClick={() => {
        onClick();
        close();
      }}
    >
      {children}
    </button>
  );
};

export { DropdownMenuItem };
