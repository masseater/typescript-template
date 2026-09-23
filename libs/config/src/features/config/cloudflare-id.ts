import { Schema } from "effect";

const minimumCloudflareApiTokenLength = 20;

const CloudflareApiToken = Schema.String.check(Schema.isMinLength(minimumCloudflareApiTokenLength));

const cloudflareIdLength = 32;

const CloudflareId = Schema.String.check(
  Schema.isPattern(new RegExp(`^[a-f0-9]{${cloudflareIdLength}}$`, "u")),
);

export { CloudflareApiToken, CloudflareId, minimumCloudflareApiTokenLength };
