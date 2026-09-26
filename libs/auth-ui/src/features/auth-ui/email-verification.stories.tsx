import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { expect, fn, userEvent } from "storybook/test";

import preview, { playTask } from "../../../storybook/preview";
import { EmailVerification } from "./email-verification";

const sentVerification = fn();

const meta = preview.meta({ component: EmailVerification });

export const Opened = meta.story({
  beforeEach: ({ msw }) => {
    globalThis.history.replaceState(undefined, "", "#token=opened-link");
    msw.use(
      http.post("/api/verify-email", () => {
        sentVerification();
        return HttpResponse.json({ status: true });
      }),
    );
    return (): void => {
      globalThis.history.replaceState(undefined, "", globalThis.location.pathname);
    };
  },
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* waitForConfirmation() {
        const confirm = yield* playTask(() =>
          canvas.findByRole("button", { name: "メールアドレスを確認する" }),
        );
        yield* playTask(() => expect(confirm).toBeEnabled());
        yield* playTask(() => expect(canvas.queryByRole("alert")).not.toBeInTheDocument());
        yield* playTask(() => expect(sentVerification).not.toHaveBeenCalled());
      }),
    ),
});

export const Expired = meta.story({
  play: ({ canvas }) =>
    Effect.runPromise(
      Effect.gen(function* showExpiredLink() {
        yield* playTask(() =>
          userEvent.click(canvas.getByRole("button", { name: "メールアドレスを確認する" })),
        );
        const failureAlert = yield* playTask(() => canvas.findByRole("alert"));
        yield* playTask(() =>
          expect(failureAlert).toHaveTextContent("確認リンクが無効か、有効期限が切れています。"),
        );
      }),
    ),
});
