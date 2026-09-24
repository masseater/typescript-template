import { Effect, Schema, type Redacted } from "effect";

import { ConfigurationInvalid } from "./configuration-invalid.ts";

const wikiPublishKey = {
  appId: "WIKI_PUBLISH_APP_ID",
  privateKey: "WIKI_PUBLISH_PRIVATE_KEY",
  repository: "WIKI_PUBLISH_REPOSITORY",
} as const;

const wikiPublishKeys = Object.values(wikiPublishKey);

const wikiPublishPermissions = { contents: "write", pull_requests: "write" } as const;

const GitHubAppId = Schema.String.check(Schema.isPattern(/^[1-9][0-9]{0,15}$/u));
const GitHubRepository = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/u),
);
const PrivateKeyPem = Schema.String.check(
  Schema.isPattern(
    /^-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+-----END (?:RSA )?PRIVATE KEY-----\s*$/u,
  ),
);

const WikiPublishScalars = Schema.Struct({
  [wikiPublishKey.appId]: Schema.optionalKey(GitHubAppId),
  [wikiPublishKey.privateKey]: Schema.optionalKey(Schema.RedactedFromValue(PrivateKeyPem)),
  [wikiPublishKey.repository]: Schema.optionalKey(GitHubRepository),
});

type WikiPublishConfig = Readonly<{
  appId: string;
  owner: string;
  privateKey: Redacted.Redacted;
  repository: string;
}>;

const readWikiPublishConfig = Effect.fn("readWikiPublishConfig")(function* readWikiPublishConfig(
  input: unknown,
) {
  const scalars = yield* Schema.decodeUnknownEffect(WikiPublishScalars)(input).pipe(
    Effect.mapError((issue) => new ConfigurationInvalid({ reason: issue.message })),
  );
  const appId = scalars[wikiPublishKey.appId];
  const privateKey = scalars[wikiPublishKey.privateKey];
  const repository = scalars[wikiPublishKey.repository];
  if (appId === undefined && privateKey === undefined && repository === undefined) {
    return undefined;
  }
  if (appId === undefined || privateKey === undefined || repository === undefined) {
    return yield* new ConfigurationInvalid({
      reason: `${wikiPublishKeys.join(", ")} are set together or not at all`,
    });
  }
  const [owner = "", repositoryName = ""] = repository.split("/");
  return {
    appId,
    owner,
    privateKey,
    repository: repositoryName,
  } satisfies WikiPublishConfig;
});

export { readWikiPublishConfig, wikiPublishKey, wikiPublishPermissions };
export type { WikiPublishConfig };
