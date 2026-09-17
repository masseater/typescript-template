import { Effect, Schema } from "effect";

class BootstrapFailure extends Schema.TaggedError<BootstrapFailure>()("BootstrapFailure", {
  code: Schema.Literals([
    "bootstrap_settings_invalid",
    "bootstrap_environment_invalid",
    "bootstrap_identity_mismatch",
    "bootstrap_stack_failed",
    "r2_object_write_permission_unavailable",
    "state_credentials_invalid",
    "state_credentials_unreadable",
    "state_credentials_write_failed",
    "state_credentials_not_encrypted",
    "state_credentials_missing",
    "state_directory_symlink_forbidden",
    "state_directory_unavailable",
    "state_migration_unverified",
    "state_environment_missing",
    "state_command_not_allowed",
    "state_command_failed",
    "state_output_not_allowed",
    "state_output_failed",
    "plaintext_secret_output_forbidden",
    "only_pulumi_allowed",
  ]),
}) {}

function fail(code: BootstrapFailure["code"]): Effect.Effect<never, BootstrapFailure> {
  return Effect.fail(new BootstrapFailure({ code }));
}

const Hex32 = Schema.String.check(Schema.isPattern(/^[a-f0-9]{32}$/u));
const Bucket = Schema.String.check(Schema.isPattern(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u));

const Settings = Schema.Struct({ accountId: Hex32, bucket: Bucket });

const Credentials = Schema.Struct({
  accessKeyId: Hex32,
  accountId: Hex32,
  bucket: Bucket,
  secretAccessKey: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/u)),
});

type StateCredentials = typeof Credentials.Type;

const parseBootstrapConfig = Effect.fn("parseBootstrapConfig")(function* parseBootstrapConfig(
  input: unknown,
) {
  return yield* Schema.decodeUnknownEffect(Settings)(input).pipe(
    Effect.mapError(() => new BootstrapFailure({ code: "bootstrap_settings_invalid" })),
  );
});

const backendUrl = Effect.fn("backendUrl")(function* backendUrl(input: unknown) {
  const config = yield* parseBootstrapConfig(input);
  const query = new URLSearchParams({
    awssdk: "v2",
    endpoint: `${config.accountId}.r2.cloudflarestorage.com`,
    region: "auto",
    s3ForcePathStyle: "true",
  });
  return `s3://${config.bucket}?${query.toString()}`;
});

const selectObjectWritePermission = Effect.fn("selectObjectWritePermission")(
  function* selectObjectWritePermission(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    groups: readonly { id: string; name: string; scopes: string[] }[],
  ) {
    const matches = groups.filter(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (group) =>
        group.name === "Workers R2 Storage Bucket Item Write" &&
        group.scopes.includes("com.cloudflare.edge.r2.bucket"),
    );
    const [match] = matches;
    if (matches.length !== 1 || match === undefined || !/^[a-f0-9]{32}$/u.test(match.id)) {
      return yield* fail("r2_object_write_permission_unavailable");
    }
    return match.id;
  },
);

const bucketPolicyResources = Effect.fn("bucketPolicyResources")(function* bucketPolicyResources(
  input: unknown,
) {
  const config = yield* parseBootstrapConfig(input);
  return JSON.stringify({
    [`com.cloudflare.edge.r2.bucket.${config.accountId}_default_${config.bucket}`]: "*",
  });
});

const parseCredentials = Effect.fn("parseCredentials")(function* parseCredentials(input: unknown) {
  return yield* Schema.decodeUnknownEffect(Credentials)(input).pipe(
    Effect.mapError(() => new BootstrapFailure({ code: "state_credentials_invalid" })),
  );
});

export {
  BootstrapFailure,
  backendUrl,
  bucketPolicyResources,
  fail,
  parseBootstrapConfig,
  parseCredentials,
  selectObjectWritePermission,
};
export type { StateCredentials };
