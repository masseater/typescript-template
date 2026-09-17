import { Cause, Effect } from "effect";
import { assert, it } from "@effect/vitest";
import { describeCause, redact } from "./secrets.ts";
import { CloudflareFailure } from "./config.ts";
import { verificationSettings } from "./verification-fixture.ts";

const confidential = [
  { key: "TEMPLATE_USER_ORIGIN", value: verificationSettings.origins.user },
  { key: "TEMPLATE_USER_ORIGIN", value: new URL(verificationSettings.origins.user).hostname },
  { key: "CLOUDFLARE_ACCOUNT_ID", value: verificationSettings.accountId },
  { key: "TEMPLATE_PREFIX", value: verificationSettings.prefix },
];

const adoptionMessage = [
  `Cannot adopt resource 'template-user/${verificationSettings.prefix}/Worker'`,
  ` (Cloudflare.Worker): it exists in the cloud on account ${verificationSettings.accountId}`,
  ` at ${verificationSettings.origins.user} but is not owned by this stack.`,
].join("");

it.effect("keeps the values that identify the deployment out of every reported failure", () =>
  Effect.sync(() => {
    const described = describeCause(Cause.die(new Error(adoptionMessage)), confidential);
    const printed = JSON.stringify(described);
    assert.include(printed, "<redacted:TEMPLATE_PREFIX>");
    assert.include(printed, "<redacted:CLOUDFLARE_ACCOUNT_ID>");
    assert.include(printed, "<redacted:TEMPLATE_USER_ORIGIN>");
    for (const { value } of confidential) {
      assert.notInclude(printed, value);
    }
  }),
);

it.effect("reports a defect as a defect instead of an unknown failure", () =>
  Effect.sync(() => {
    const unreachable = new Error("state store unreachable");
    assert.deepStrictEqual(describeCause(Cause.die(unreachable) as Cause.Cause<unknown>, []), {
      code: "defect",
      reason: "state store unreachable",
    });
    const taken = new CloudflareFailure({
      code: "database_name_taken",
      keys: ["TEMPLATE_PREFIX"],
    });
    assert.deepStrictEqual(describeCause(Cause.die(taken) as Cause.Cause<unknown>, []), {
      code: "database_name_taken",
      defect: true,
      keys: ["TEMPLATE_PREFIX"],
    });
    assert.deepStrictEqual(describeCause(Cause.die({}) as Cause.Cause<unknown>, []), {
      code: "unknown_failure",
      defect: true,
    });
  }),
);

it.effect("leaves text alone when nothing confidential appears in it", () =>
  Effect.sync(() => {
    assert.strictEqual(redact("nothing to hide", confidential), "nothing to hide");
    assert.strictEqual(redact("", confidential), "");
  }),
);
