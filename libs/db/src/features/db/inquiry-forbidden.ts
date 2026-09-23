import { Schema } from "effect";

class InquiryForbidden extends Schema.TaggedError<InquiryForbidden>()("InquiryForbidden", {}) {}

export { InquiryForbidden };
