import { expect, screen, userEvent, waitFor } from "storybook/test";
import { DropdownMenu } from "./dropdown-menu";
import { DropdownMenuContent } from "./dropdown-menu-content";
import { DropdownMenuLinkItem } from "./dropdown-menu-link-item";
import { DropdownMenuTrigger } from "./dropdown-menu-trigger";
import type { ReactElement } from "react";
import preview from "../../../.storybook/preview";

const anchor = <a href="/security" aria-label="認証設定" />;

function stayOnPage(event: Readonly<{ preventDefault: () => void }>): void {
  event.preventDefault();
}

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

export const ClosesOnClick = meta.story({
  args: { render: <a href="/security" aria-label="認証設定" onClick={stayOnPage} /> },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "アカウント" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "認証設定" }));
    await waitFor(async () => {
      await expect(screen.queryByRole("menuitem", { name: "認証設定" })).not.toBeInTheDocument();
    });
  },
});
