import { Option, Schema } from "effect";

import { laterPage, maximumMemberPage } from "#shared/contracts/index.ts";

const MessagesSearchParams = Schema.Struct({
  newGroup: Schema.optionalKey(Schema.Literal(true)),
  page: Schema.optionalKey(laterPage(maximumMemberPage)),
});

const ConversationSearchParams = Schema.Struct({
  page: Schema.optionalKey(laterPage(maximumMemberPage)),
});

type MessagesSearch = typeof MessagesSearchParams.Type;
type ConversationSearch = typeof ConversationSearchParams.Type;

class InvalidMessagesSearch extends Error {
  override readonly name = "InvalidMessagesSearch";
}

const decodeMessagesSearch = Schema.decodeUnknownOption(MessagesSearchParams);
const decodeConversationSearch = Schema.decodeUnknownOption(ConversationSearchParams);

function normalizeMessagesSearch(raw: unknown): MessagesSearch {
  return Option.getOrThrowWith(decodeMessagesSearch(raw), () => new InvalidMessagesSearch());
}

function normalizeConversationSearch(raw: unknown): ConversationSearch {
  return Option.getOrThrowWith(decodeConversationSearch(raw), () => new InvalidMessagesSearch());
}

export { InvalidMessagesSearch, normalizeConversationSearch, normalizeMessagesSearch };
export type { ConversationSearch, MessagesSearch };
