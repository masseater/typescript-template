import { Effect } from "effect";
import { noop } from "es-toolkit";
import { expect, screen, userEvent } from "storybook/test";

import preview, { playTask } from "../../../../../storybook/preview";
import { DropdownMenu } from "./dropdown-menu";
import { DropdownMenuContent } from "./dropdown-menu-content";
import { DropdownMenuItem } from "./dropdown-menu-item";
import { DropdownMenuLabel } from "./dropdown-menu-label";
import { DropdownMenuTrigger } from "./dropdown-menu-trigger";

import type { ReactElement } from "react";

const meta = preview.meta({
  args: { children: "taro@example.com" },
  component: DropdownMenuLabel,
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* openMenuLabel() {
        yield* playTask(() =>
          userEvent.click(canvas.getByRole("button", { name: "利用者の操作" })),
        );
        const accountLabel = yield* playTask(() => screen.findByText("taro@example.com"));
        yield* playTask(() => expect(accountLabel).toBeInTheDocument());
      }),
    ),
  render: ({ children }): ReactElement => (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="利用者の操作">{"操作"}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{children}</DropdownMenuLabel>
        <DropdownMenuItem onClick={noop}>{"権限を変更"}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
});

export const Default = meta.story();
