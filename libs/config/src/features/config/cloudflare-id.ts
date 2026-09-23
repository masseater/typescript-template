import { Schema } from "effect";

const cloudflareIdLength = 32;
const minimumCloudflareApiTokenLength = 20;

const CloudflareId = Schema.String.check(
  Schema.isPattern(new RegExp(`^[a-f0-9]{${cloudflareIdLength}}$`, "u")),
);
const CloudflareApiToken = Schema.String.check(Schema.isMinLength(minimumCloudflareApiTokenLength));

export { CloudflareApiToken, CloudflareId, minimumCloudflareApiTokenLength };
