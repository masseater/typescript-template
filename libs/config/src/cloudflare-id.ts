import { Schema } from "effect";

export const CloudflareId = Schema.String.check(Schema.isPattern(/^[a-f0-9]{32}$/u));
