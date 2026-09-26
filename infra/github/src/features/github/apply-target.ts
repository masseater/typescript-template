import { Stage } from "alchemy";
import * as GitHub from "alchemy/GitHub";
import { Config, Effect, Schema } from "effect";

const repositoryStage = "repository";
const deploymentEnvironments = ["staging", "production"] as const;

const DeploymentEnvironment = Schema.Literals(deploymentEnvironments);

type DeploymentEnvironment = typeof DeploymentEnvironment.Type;
type StackTarget = Readonly<{ stack: string; stage: string }>;
type ApplyTarget =
  | Readonly<{ unit: "github" }>
  | Readonly<{ environment: DeploymentEnvironment; unit: "wiki-publisher" }>;

const stackName = (unit: ApplyTarget["unit"]): string => `template-${unit}`;

const applyTarget = (selection: ApplyTarget): StackTarget => ({
  stack: stackName(selection.unit),
  stage: selection.unit === "github" ? repositoryStage : selection.environment,
});

const legacyTarget = (unit: ApplyTarget["unit"], prefix: string): StackTarget => ({
  stack: `${prefix}-${unit}`,
  stage: prefix,
});

const stagedAt = <Staged extends string, A, E, R>(
  stages: Schema.Codec<Staged>,
  program: (stage: Staged) => Effect.Effect<A, E, R>,
): Effect.Effect<A, Config.ConfigError | E, R | Stage> =>
  Effect.gen(function* stagedProgram() {
    const staged = yield* Schema.decodeUnknownEffect(stages)(yield* Stage).pipe(
      Effect.mapError((mismatch) => new Config.ConfigError(mismatch)),
    );
    return yield* program(staged);
  });

const environmentRef = (environment: DeploymentEnvironment): Effect.Effect<GitHub.Environment> =>
  GitHub.Environment.ref(environment, { stack: stackName("github"), stage: repositoryStage });

export {
  DeploymentEnvironment,
  applyTarget,
  deploymentEnvironments,
  environmentRef,
  legacyTarget,
  repositoryStage,
  stackName,
  stagedAt,
};
export type { ApplyTarget, StackTarget };
