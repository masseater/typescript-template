import { Schema } from "effect";

class InquiryNotFound extends Schema.TaggedError<InquiryNotFound>()("InquiryNotFound", {}) {}

export { InquiryNotFound };
