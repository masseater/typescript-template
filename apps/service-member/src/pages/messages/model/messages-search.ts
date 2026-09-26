import { laterPage } from "@repo/config/paging";
import { Option, Schema } from "effect";

import { maximumMemberPage } from "#shared/contracts/index.ts";

const MessagesSearchParams = Schema.Struct({
  newGroup: Schema.optionalKey(Schema.Literal(true)),
  page: Schema.optionalKey(laterPage(maximumMemberPage)),
});

const ConversationSearchParams = Schema.Struct({
  page: Schema.optionalKey(laterPage(maximumMemberPage)),
});

type MessagesSearch = typeof MessagesSearchParams.Type;
type ConversationSearch = typeof ConversationSearchParams.Type;

class InvalidMessagesSearch extends Schema.TaggedError<InvalidMessagesSearch>()(
  "InvalidMessagesSearch",
  {},
) {}

const decodeMessagesSearch = Schema.decodeUnknownOption(MessagesSearchParams);
const decodeConversationSearch = Schema.decodeUnknownOption(ConversationSearchParams);

function normalizeMessagesSearch(raw: unknown): MessagesSearch {
  return Option.getOrThrowWith(decodeMessagesSearch(raw), () => InvalidMessagesSearch.make());
}

function normalizeConversationSearch(raw: unknown): ConversationSearch {
  return Option.getOrThrowWith(decodeConversationSearch(raw), () => InvalidMessagesSearch.make());
}

export { InvalidMessagesSearch, normalizeConversationSearch, normalizeMessagesSearch };
export type { ConversationSearch, MessagesSearch };
