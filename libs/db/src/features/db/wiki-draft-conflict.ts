import { Schema } from "effect";

class WikiDraftConflict extends Schema.TaggedError<WikiDraftConflict>()("WikiDraftConflict", {}) {}

export { WikiDraftConflict };
