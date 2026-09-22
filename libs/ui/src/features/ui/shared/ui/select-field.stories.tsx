import { Effect } from "effect";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";

import preview, { playTask } from "../../../storybook/preview";
import { SelectField } from "./select-field";

const meta = preview.meta({
  args: {
    label: "権限",
    name: "role",
    onValueChange: fn<(value: string) => void>(),
    options: [
      { label: "一般", value: "member" },
      { label: "管理者", value: "admin" },
    ],
    value: "member",
  },
  component: SelectField,
});

export const Default = meta.story();

export const Admin = meta.story({ args: { value: "admin" } });

export const Selects = meta.story({
  args: { onValueChange: fn<(value: string) => void>() },
  parameters: {
    a11y: { config: { rules: [{ enabled: false, id: "aria-valid-attr-value" }] } },
  },
  play: ({ args, canvas }) =>
    Effect.runPromise(
      Effect.gen(function* selectAdmin() {
        yield* playTask(() => userEvent.click(canvas.getByRole("combobox")));
        const adminRoleChoice = yield* playTask(() =>
          screen.findByRole("option", { name: "管理者" }),
        );
        yield* playTask(() => userEvent.click(adminRoleChoice));
        yield* playTask(() => expect(args.onValueChange).toHaveBeenCalledWith("admin"));
        const listboxHasClosed = (): Promise<void> =>
          expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        yield* playTask(() => userEvent.keyboard("{Escape}"));
        yield* playTask(() => waitFor(listboxHasClosed));
      }),
    ),
});
