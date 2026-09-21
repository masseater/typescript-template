import { Effect } from "effect";
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
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* followMenuLink() {
        const trigger = canvas.getByRole("button", { name: "アカウント" });
        yield* Effect.promise(() => userEvent.click(trigger));
        const menuItem = yield* Effect.promise(() =>
          screen.findByRole("menuitem", { name: "認証設定" }),
        );
        yield* Effect.promise(() => expect(menuItem).toHaveAttribute("href", "/"));
        yield* Effect.promise(() => userEvent.click(menuItem));
        const menuHasCollapsed = (): Promise<void> =>
          expect(trigger).toHaveAttribute("aria-expanded", "false");
        yield* Effect.promise(() => waitFor(menuHasCollapsed));
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
