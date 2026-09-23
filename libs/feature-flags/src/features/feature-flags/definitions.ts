/** @canonical-values feature-flag.variation */
export const flagVariations = ["disabled", "enabled"] as const;
export const FLAG_VARIATION = {
  disabled: flagVariations[0],
  enabled: flagVariations[1],
} as const;

export type FlagVariation = (typeof flagVariations)[number];

/** @canonical-values feature-flag.key */
export const flagKeys = [] as const;

export type FlagKey = (typeof flagKeys)[number];

export type FlagDefinition = Readonly<{
  defaultVariation: FlagVariation;
  description: string;
  enabled: boolean;
  key: FlagKey;
  variations: Readonly<Record<FlagVariation, boolean>>;
}>;

export const flagDefinitions: readonly FlagDefinition[] = [];

const flagDefinitionByKey: Readonly<Record<FlagKey, FlagDefinition>> = Object.fromEntries(
  flagDefinitions.map((definition) => [definition.key, definition]),
);

export const flagDefinitionFor = (flagKey: FlagKey): FlagDefinition => flagDefinitionByKey[flagKey];

export const variationForBoolean = (isEnabled: boolean): FlagVariation =>
  isEnabled ? FLAG_VARIATION.enabled : FLAG_VARIATION.disabled;

export const booleanForVariation = (variation: FlagVariation): boolean =>
  variation === FLAG_VARIATION.enabled;

/** @canonical-values feature-flag.evaluation-kind */
export const flagEvaluationKinds = ["evaluated", "fail-closed"] as const;
export const FLAG_EVALUATION_KIND = {
  evaluated: flagEvaluationKinds[0],
  failClosed: flagEvaluationKinds[1],
} as const;

export type FlagEvaluationKind = (typeof flagEvaluationKinds)[number];

export const auditTargetForToggle = (
  toggle: Readonly<{
    flagKey: FlagKey;
    from: boolean;
    to: boolean;
  }>,
): string => `${String(toggle.flagKey)}:${toggle.from}:${toggle.to}`;
