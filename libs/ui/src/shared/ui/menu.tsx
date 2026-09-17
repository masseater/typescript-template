import type { Children } from "./types";
import { MenuPopup } from "./menu-popup";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { ReactElement } from "react";
import { buttonVariants } from "./button-variants";

type MenuProps = Children &
  Readonly<{ label: string; trigger: Children["children"]; align?: "end" | "start" }>;

function Menu({ align = "end", children, label, trigger }: MenuProps): ReactElement {
  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger
        data-slot="menu-trigger"
        aria-label={label}
        className={buttonVariants({ variant: "secondary" })}
      >
        {trigger}
      </MenuPrimitive.Trigger>
      <MenuPopup align={align}>{children}</MenuPopup>
    </MenuPrimitive.Root>
  );
}

export { Menu };
