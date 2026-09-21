import { Effect } from "effect";
import { expect } from "storybook/test";

import preview from "../storybook/preview";
import { EmailVerification } from "./email-verification";

const meta = preview.meta({ component: EmailVerification });

export const Expired = meta.story({
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* showExpiredLink() {
        const failureAlert = yield* Effect.promise(() => canvas.findByRole("alert"));
        yield* Effect.promise(() => expect(failureAlert).toBeInTheDocument());
      }),
    ),
});
