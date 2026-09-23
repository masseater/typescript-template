import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { WikiPageNotFound } from "./wiki-page-not-found.ts";

const WikiSearchHit = Schema.Struct({
  content: Schema.String,
  id: Schema.String,
  type: Schema.Literals(["page", "heading", "text"]),
  url: Schema.String,
});

const WikiSearchHits = Schema.Struct({
  mode: Schema.Literals(["semantic", "keyword_only"]),
  results: Schema.Array(WikiSearchHit),
});

const searchWiki = Rpc.make("searchWiki", {
  payload: { query: Schema.String },
  success: WikiSearchHits,
});

const listWikiPages = Rpc.make("listWikiPages", {
  payload: {},
  success: Schema.String,
});

const readWikiPage = Rpc.make("readWikiPage", {
  error: WikiPageNotFound,
  payload: { url: Schema.String },
  success: Schema.String,
});

class WikiRpcs extends RpcGroup.make(searchWiki, listWikiPages, readWikiPage) {}

export { WikiRpcs, WikiSearchHits };
