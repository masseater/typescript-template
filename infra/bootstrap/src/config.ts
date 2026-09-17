import { object, pipe, regex, safeParse, string } from "valibot";
import type { InferOutput } from "valibot";

const HEX_32_PATTERN = /^[a-f0-9]{32}$/u;

const hex32 = pipe(string(), regex(HEX_32_PATTERN));
const settingsSchema = object({
  accountId: hex32,
  bucket: pipe(string(), regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u)),
});
const credentialsSchema = object({
  accessKeyId: hex32,
  accountId: hex32,
  bucket: settingsSchema.entries.bucket,
  secretAccessKey: pipe(string(), regex(/^[a-f0-9]{64}$/u)),
});

type BootstrapConfig = InferOutput<typeof settingsSchema>;
type StateCredentials = InferOutput<typeof credentialsSchema>;

interface PermissionGroup {
  readonly id: string;
  readonly name: string;
  readonly scopes: readonly string[];
}

function parseBootstrapConfig(input: unknown): BootstrapConfig {
  const result = safeParse(settingsSchema, input);
  if (!result.success) {
    throw new Error("bootstrap_settings_invalid");
  }
  return result.output;
}

function backendUrl(input: unknown): string {
  const config = parseBootstrapConfig(input);
  const query = new URLSearchParams({
    awssdk: "v2",
    endpoint: `${config.accountId}.r2.cloudflarestorage.com`,
    region: "auto",
    s3ForcePathStyle: "true",
  });
  return `s3://${config.bucket}?${query.toString()}`;
}

function selectObjectWritePermission(groups: readonly PermissionGroup[]): string {
  const matches = groups.filter(
    (group) =>
      group.name === "Workers R2 Storage Bucket Item Write" &&
      group.scopes.includes("com.cloudflare.edge.r2.bucket"),
  );
  const [match] = matches;
  if (matches.length !== 1 || match === undefined || !HEX_32_PATTERN.test(match.id)) {
    throw new Error("r2_object_write_permission_unavailable");
  }
  return match.id;
}

function bucketPolicyResources(input: unknown): string {
  const config = parseBootstrapConfig(input);
  return JSON.stringify({
    [`com.cloudflare.edge.r2.bucket.${config.accountId}_default_${config.bucket}`]: "*",
  });
}

function parseCredentials(input: unknown): StateCredentials {
  const result = safeParse(credentialsSchema, input);
  if (!result.success) {
    throw new Error("state_credentials_invalid");
  }
  return result.output;
}

export {
  backendUrl,
  bucketPolicyResources,
  parseBootstrapConfig,
  parseCredentials,
  selectObjectWritePermission,
};
export type { StateCredentials };
