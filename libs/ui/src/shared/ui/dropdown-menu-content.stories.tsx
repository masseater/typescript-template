import { Effect } from "effect";
import { noop } from "es-toolkit";
import { expect, screen, userEvent } from "storybook/test";

import preview, { playTask } from "../../../storybook/preview";
import { DropdownMenu } from "./dropdown-menu";
import { DropdownMenuContent } from "./dropdown-menu-content";
import { DropdownMenuItem } from "./dropdown-menu-item";
import { DropdownMenuTrigger } from "./dropdown-menu-trigger";

import type { ReactElement } from "react";

const meta = preview.meta({
  args: {
    children: (
      <>
        <DropdownMenuItem onClick={noop}>権限を変更</DropdownMenuItem>
        <DropdownMenuItem onClick={noop}>確認メールを再送</DropdownMenuItem>
      </>
    ),
  },
  component: DropdownMenuContent,
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* openMenuContent() {
        yield* playTask(() =>
          userEvent.click(canvas.getByRole("button", { name: "利用者の操作" })),
        );
        const menu = yield* playTask(() => screen.findByRole("menu"));
        yield* playTask(() => expect(menu).toBeInTheDocument());
      }),
    ),
  render: ({ children }): ReactElement => (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="利用者の操作">操作</DropdownMenuTrigger>
      <DropdownMenuContent>{children}</DropdownMenuContent>
    </DropdownMenu>
  ),
});

export const Default = meta.story();
