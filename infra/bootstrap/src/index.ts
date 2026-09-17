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
import { createHash } from "node:crypto";

const config = parseBootstrapConfig(new Config().requireObject<unknown>("settings"));
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
        permissionGroups: [{ id: groups.results.apply(selectObjectWritePermission) }],
        resources: bucketPolicyResources(config),
      },
    ],
  },
  { additionalSecretOutputs: ["value"], dependsOn: [bucket, privateDomain], protect: true },
);

const stateBackend = backendUrl(config);
const stateCredentials = secret(
  all([token.id, token.value]).apply(([accessKeyId, value]) => ({
    accessKeyId,
    accountId: config.accountId,
    bucket: config.bucket,
    secretAccessKey: createHash("sha256").update(value).digest("hex"),
  })),
);

export { stateBackend, stateCredentials };
