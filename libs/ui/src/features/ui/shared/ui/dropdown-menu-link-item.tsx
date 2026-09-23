import { createLink } from "@tanstack/react-router";
import { useStyletron } from "baseui";
import { cn } from "cn";

import { useDropdownMenu } from "./dropdown-menu-context";

import type { ComponentProps, ReactElement } from "react";

const DropdownMenuLinkAnchor = ({
  children,
  className,
  onClick,
  ...anchor
}: Readonly<ComponentProps<"a">>): ReactElement => {
  const { close } = useDropdownMenu();
  const [css, theme] = useStyletron();
  return (
    <a
      {...anchor}
      role="menuitem"
      tabIndex={0}
      data-slot="dropdown-menu-link-item"
      className={cn(
        css({
          borderRadius: theme.borders.radius200,
          color: theme.colors.contentPrimary,
          display: "block",
          fontSize: theme.typography.ParagraphMedium.fontSize,
          lineHeight: theme.typography.ParagraphMedium.lineHeight,
          paddingBottom: theme.sizing.scale300,
          paddingLeft: theme.sizing.scale300,
          paddingRight: theme.sizing.scale300,
          paddingTop: theme.sizing.scale300,
          textDecoration: "none",
          ":hover": {
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.contentPrimary,
          },
        }),
        className,
      )}
      onClick={(click) => {
        onClick?.(click);
        close();
      }}
      onKeyDown={(keyPress) => {
        if (keyPress.key === "Enter" || keyPress.key === " ") {
          close();
        }
      }}
    >
      {children}
    </a>
  );
};

const DropdownMenuLinkItem = createLink(DropdownMenuLinkAnchor);

export { DropdownMenuLinkItem };
