import { DropdownMenu } from "./dropdown-menu";
import { DropdownMenuTrigger } from "./dropdown-menu-trigger";
import type { ReactElement } from "react";
import preview from "../../../.storybook/preview";

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

const Default = meta.story();

const Disabled = meta.story({ args: { disabled: true } });

export { Default, Disabled };
