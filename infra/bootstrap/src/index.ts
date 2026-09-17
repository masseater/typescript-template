import { createHash } from "node:crypto";
import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import {
  backendUrl,
  bucketPolicyResources,
  parseBootstrapConfig,
  selectObjectWritePermission,
} from "./config.ts";

const config = parseBootstrapConfig(new pulumi.Config().requireObject<unknown>("settings"));
const bucket = new cloudflare.R2Bucket(
  "pulumi-state",
  {
    accountId: config.accountId,
    name: config.bucket,
  },
  { protect: true },
);
const privateDomain = new cloudflare.R2ManagedDomain("state-public-access", {
  accountId: config.accountId,
  bucketName: bucket.name,
  enabled: false,
});
const groups = cloudflare.getAccountApiTokenPermissionGroupsListOutput({
  accountId: config.accountId,
});
const token = new cloudflare.AccountToken(
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
  { protect: true, dependsOn: [bucket, privateDomain], additionalSecretOutputs: ["value"] },
);

export const stateBackend = backendUrl(config);
export const stateCredentials = pulumi.secret(
  pulumi.all([token.id, token.value]).apply(([accessKeyId, value]) => ({
    accountId: config.accountId,
    bucket: config.bucket,
    accessKeyId,
    secretAccessKey: createHash("sha256").update(value).digest("hex"),
  })),
);
