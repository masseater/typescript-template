import { Effect } from "effect";
import { noop } from "es-toolkit";
import { expect, screen, userEvent } from "storybook/test";

import preview from "../../../storybook/preview";
import { DropdownMenu } from "./dropdown-menu";
import { DropdownMenuContent } from "./dropdown-menu-content";
import { DropdownMenuItem } from "./dropdown-menu-item";
import { DropdownMenuLabel } from "./dropdown-menu-label";
import { DropdownMenuTrigger } from "./dropdown-menu-trigger";

const meta = preview.meta({
  args: {
    children: (
      <>
        <DropdownMenuTrigger aria-label="利用者の操作">操作</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>taro@example.com</DropdownMenuLabel>
          <DropdownMenuItem onClick={noop}>権限を変更</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={noop}>
            削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </>
    ),
  },
  component: DropdownMenu,
});

export const Closed = meta.story();

export const Opened = meta.story({
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* openMenu() {
        yield* Effect.promise(() =>
          userEvent.click(canvas.getByRole("button", { name: "利用者の操作" })),
        );
        const menuItem = yield* Effect.promise(() =>
          screen.findByRole("menuitem", { name: "権限を変更" }),
        );
        yield* Effect.promise(() => expect(menuItem).toBeInTheDocument());
      }),
    ),
});
