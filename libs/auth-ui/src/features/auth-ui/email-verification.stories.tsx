import { Effect } from "effect";
import { expect } from "storybook/test";

import preview, { playTask } from "../../../storybook/preview";
import { EmailVerification } from "./email-verification";

const meta = preview.meta({ component: EmailVerification });

export const Expired = meta.story({
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* showExpiredLink() {
        const failureAlert = yield* playTask(() => canvas.findByRole("alert"));
        yield* playTask(() => expect(failureAlert).toBeInTheDocument());
      }),
    ),
});
