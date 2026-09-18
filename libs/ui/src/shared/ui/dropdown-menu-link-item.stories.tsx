import { expect, screen, userEvent, waitFor } from "storybook/test";

import preview from "../../../storybook/preview";
import { DropdownMenu } from "./dropdown-menu";
import { DropdownMenuContent } from "./dropdown-menu-content";
import { DropdownMenuLinkItem } from "./dropdown-menu-link-item";
import { DropdownMenuTrigger } from "./dropdown-menu-trigger";

import type { ReactElement } from "react";

const meta = preview.meta({
  args: { children: "認証設定" },
  component: DropdownMenuLinkItem,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "アカウント" });
    await userEvent.click(trigger);
    const item = await screen.findByRole("menuitem", { name: "認証設定" });
    await expect(item).toHaveAttribute("href", "/");
    await userEvent.click(item);
    await waitFor(async () => {
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  },
  render: ({ children }): ReactElement => (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="アカウント">メニュー</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLinkItem to="/">{children}</DropdownMenuLinkItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
});

export const Default = meta.story();
