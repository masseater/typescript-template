import { Effect } from "effect";

const maySendGroupMessage = Effect.fn("maySendGroupMessage")(function* maySendGroupMessage(
  _senderId: string,
  _conversationId: string,
) {
  return true;
});

export { maySendGroupMessage };
