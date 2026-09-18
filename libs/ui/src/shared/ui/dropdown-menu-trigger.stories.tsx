import preview from "../../../storybook/preview";
import { DropdownMenu } from "./dropdown-menu";
import { DropdownMenuTrigger } from "./dropdown-menu-trigger";

import type { ReactElement } from "react";

const meta = preview.meta({
  args: { "aria-label": "利用者の操作", children: "操作" },
  component: DropdownMenuTrigger,
  render: ({ "aria-label": label, children, disabled }): ReactElement => (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={label} disabled={disabled === true}>
        {children}
      </DropdownMenuTrigger>
    </DropdownMenu>
  ),
});

export const Default = meta.story();

export const Disabled = meta.story({ args: { disabled: true } });
