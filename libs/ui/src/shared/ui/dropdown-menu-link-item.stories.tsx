import type { ReactElement } from "react";
import { expect, screen, userEvent } from "storybook/test";

import preview from "../../../.storybook/preview";
import { DropdownMenu } from "./dropdown-menu";
import { DropdownMenuContent } from "./dropdown-menu-content";
import { DropdownMenuLinkItem } from "./dropdown-menu-link-item";
import { DropdownMenuTrigger } from "./dropdown-menu-trigger";

const meta = preview.meta({
  args: { children: "認証設定" },
  component: DropdownMenuLinkItem,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "アカウント" }));
    const item = await screen.findByRole("menuitem", { name: "認証設定" });
    await expect(item).toHaveAttribute("href", "/");
    await userEvent.click(item);
    await expect(screen.queryByRole("menuitem", { name: "認証設定" })).not.toBeInTheDocument();
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
