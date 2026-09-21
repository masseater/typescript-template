import { Effect } from "effect";
import { expect, screen, userEvent, waitFor } from "storybook/test";

import preview, { playTask } from "../../../storybook/preview";
import { DropdownMenu } from "./dropdown-menu";
import { DropdownMenuContent } from "./dropdown-menu-content";
import { DropdownMenuLinkItem } from "./dropdown-menu-link-item";
import { DropdownMenuTrigger } from "./dropdown-menu-trigger";

import type { ReactElement } from "react";

const meta = preview.meta({
  args: { children: "認証設定" },
  component: DropdownMenuLinkItem,
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* followMenuLink() {
        const trigger = canvas.getByRole("button", { name: "アカウント" });
        yield* playTask(() => userEvent.click(trigger));
        const menuItem = yield* playTask(() =>
          screen.findByRole("menuitem", { name: "認証設定" }),
        );
        yield* playTask(() => expect(menuItem).toHaveAttribute("href", "/"));
        yield* playTask(() => userEvent.click(menuItem));
        const menuHasCollapsed = (): Promise<void> =>
          expect(trigger).toHaveAttribute("aria-expanded", "false");
        yield* playTask(() => waitFor(menuHasCollapsed));
      }),
    ),
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
