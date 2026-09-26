import { Context, Effect, Layer } from "effect";

import { FlagEditorRequired } from "./flag-editor-required.ts";

class FlagEditorAccess extends Context.Service<
  FlagEditorAccess,
  {
    readonly assertEditor: (
      user: Readonly<{ id: string; permission: string | null }>,
    ) => Effect.Effect<void, FlagEditorRequired>;
  }
>()("@repo/feature-flags/features/feature-flags/flag-editor-access/FlagEditorAccess") {}

const allowAllEditors = Layer.succeed(FlagEditorAccess, {
  assertEditor: () => Effect.void,
});

const editorsOnly = (viewers: ReadonlySet<string>): Layer.Layer<FlagEditorAccess> =>
  Layer.succeed(FlagEditorAccess, {
    assertEditor: (user) =>
      viewers.has(user.id) ? Effect.fail(FlagEditorRequired.make()) : Effect.void,
  });

export { FlagEditorAccess, allowAllEditors, editorsOnly };
