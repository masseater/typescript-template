import { noop } from "es-toolkit";
import type { ReactElement } from "react";
import { expect, screen, userEvent } from "storybook/test";

import preview from "../../../.storybook/preview";
import { DropdownMenu } from "./dropdown-menu";
import { DropdownMenuContent } from "./dropdown-menu-content";
import { DropdownMenuItem } from "./dropdown-menu-item";
import { DropdownMenuLabel } from "./dropdown-menu-label";
import { DropdownMenuTrigger } from "./dropdown-menu-trigger";

const meta = preview.meta({
  args: { children: "taro@example.com" },
  component: DropdownMenuLabel,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "利用者の操作" }));
    await expect(await screen.findByText("taro@example.com")).toBeInTheDocument();
  },
  render: ({ children }): ReactElement => (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="利用者の操作">操作</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{children}</DropdownMenuLabel>
        <DropdownMenuItem onClick={noop}>権限を変更</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
});

export const Default = meta.story();
