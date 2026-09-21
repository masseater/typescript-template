import { Option, Schema } from "effect";

import { Identifier, laterPage, maximumMessagingPage } from "#shared/contracts/index.ts";

const MessagesSearchParams = Schema.Struct({
  page: Schema.optionalKey(laterPage(maximumMessagingPage)),
  peer: Schema.optionalKey(Identifier),
});

const ConversationSearchParams = Schema.Struct({
  page: Schema.optionalKey(laterPage(maximumMessagingPage)),
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

function pageSearch(page: number): ConversationSearch {
  return page <= 1 ? {} : { page };
}

function listPageSearch(page: number, peer: string | undefined): MessagesSearch {
  return {
    ...(peer === undefined ? {} : { peer }),
    ...(page <= 1 ? {} : { page }),
  };
}

export {
  InvalidMessagesSearch,
  listPageSearch,
  normalizeConversationSearch,
  normalizeMessagesSearch,
  pageSearch,
};
export type { ConversationSearch, MessagesSearch };
