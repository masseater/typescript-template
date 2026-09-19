import { ApplicationName } from "@repo/config";
import { Effect, Schema } from "effect";

const ProfileName = Schema.Literals(["peak", "smoke"]);

const peak = Effect.succeed("peak" as const);
const smoke = Effect.succeed("smoke" as const);

export const loadCliArguments = Schema.Struct({
  app: ApplicationName,
  profile: ProfileName.pipe(Schema.withDecodingDefaultKey(peak)),
});

export const loadCiArguments = Schema.Struct({
  app: ApplicationName,
  profile: ProfileName.pipe(Schema.withDecodingDefaultKey(smoke)),
});
