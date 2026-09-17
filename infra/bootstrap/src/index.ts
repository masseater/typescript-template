import {
  AccountToken,
  R2Bucket,
  R2ManagedDomain,
  getAccountApiTokenPermissionGroupsListOutput,
} from "@pulumi/cloudflare";
import { Config, all, secret } from "@pulumi/pulumi";
import {
  backendUrl,
  bucketPolicyResources,
  parseBootstrapConfig,
  selectObjectWritePermission,
} from "./config.ts";
import { Effect } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import { createHash } from "node:crypto";

const config = await Effect.runPromise(
  parseBootstrapConfig(new Config().requireObject<unknown>("settings")),
);
const bucket = new R2Bucket(
  "pulumi-state",
  {
    accountId: config.accountId,
    name: config.bucket,
  },
  { protect: true },
);
const privateDomain = new R2ManagedDomain("state-public-access", {
  accountId: config.accountId,
  bucketName: bucket.name,
  enabled: false,
});
const groups = getAccountApiTokenPermissionGroupsListOutput({
  accountId: config.accountId,
});
const token = new AccountToken(
  "pulumi-state-token",
  {
    accountId: config.accountId,
    name: `${config.bucket}-state`,
    policies: [
      {
        effect: "allow",
        permissionGroups: [
          {
            // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
            id: groups.results.apply(async (results) =>
              Effect.runPromise(selectObjectWritePermission(results)),
            ),
          },
        ],
        resources: await Effect.runPromise(bucketPolicyResources(config)),
      },
    ],
  },
  { additionalSecretOutputs: ["value"], dependsOn: [bucket, privateDomain], protect: true },
);

const stateBackend = await Effect.runPromise(backendUrl(config));
const stateCredentials = secret(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  all([token.id, token.value]).apply(([accessKeyId, value]) => ({
    accessKeyId,
    accountId: config.accountId,
    bucket: config.bucket,
    secretAccessKey: createHash("sha256").update(value).digest("hex"),
  })),
);

export { stateBackend, stateCredentials };
