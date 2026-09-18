import { noop } from "es-toolkit";
import type { ReactElement } from "react";
import { expect, screen, userEvent } from "storybook/test";

import preview from "../../../.storybook/preview";
import { DropdownMenu } from "./dropdown-menu";
import { DropdownMenuContent } from "./dropdown-menu-content";
import { DropdownMenuItem } from "./dropdown-menu-item";
import { DropdownMenuTrigger } from "./dropdown-menu-trigger";

const meta = preview.meta({
  args: { children: "権限を変更", onClick: noop },
  component: DropdownMenuItem,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "利用者の操作" }));
    await expect(await screen.findByRole("menuitem")).toBeInTheDocument();
  },
  render: ({ children, disabled, onClick: handleClick, variant }): ReactElement => (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="利用者の操作">操作</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          disabled={disabled === true}
          onClick={handleClick}
          variant={variant ?? "default"}
        >
          {children}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
});

export const Default = meta.story();

export const Destructive = meta.story({ args: { children: "削除", variant: "destructive" } });

export const Disabled = meta.story({ args: { disabled: true } });
