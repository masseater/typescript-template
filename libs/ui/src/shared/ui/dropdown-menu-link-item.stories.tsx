import { expect, screen, userEvent } from "storybook/test";

import preview from "../../../.storybook/preview";
import { DropdownMenu } from "./dropdown-menu";
import { DropdownMenuContent } from "./dropdown-menu-content";
import { DropdownMenuLinkItem } from "./dropdown-menu-link-item";
import { DropdownMenuTrigger } from "./dropdown-menu-trigger";

import type { ReactElement } from "react";

const anchor = <a href="/security" aria-label="認証設定" />;

const meta = preview.meta({
  args: { children: "認証設定", render: anchor },
  component: DropdownMenuLinkItem,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "アカウント" }));
    await expect(await screen.findByRole("menuitem", { name: "認証設定" })).toBeInTheDocument();
  },
  render: ({ children, render }): ReactElement => (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="アカウント">メニュー</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLinkItem render={render}>{children}</DropdownMenuLinkItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
});

export const Default = meta.story();
