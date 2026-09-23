/** @canonical-values feature-flag.key */
export const flagKeys = ["member-board"] as const;
export const FLAG_KEY = { memberBoard: flagKeys[0] } as const;

/** @canonical-values feature-flag.variation */
export const flagVariations = ["disabled", "enabled"] as const;
export const FLAG_VARIATION = {
  disabled: flagVariations[0],
  enabled: flagVariations[1],
} as const;

export type FlagVariation = (typeof flagVariations)[number];

export type FlagKey = (typeof flagKeys)[number];

export type FlagDefinition = Readonly<{
  defaultVariation: FlagVariation;
  description: string;
  enabled: boolean;
  key: FlagKey;
  variations: Readonly<Record<FlagVariation, boolean>>;
}>;

export const flagDefinitions: readonly FlagDefinition[] = [
  {
    defaultVariation: FLAG_VARIATION.disabled,
    description: "会員向けアプリの掲示板タブを表示する",
    enabled: true,
    key: FLAG_KEY.memberBoard,
    variations: { [FLAG_VARIATION.disabled]: false, [FLAG_VARIATION.enabled]: true },
  },
];

export const flagDefinitionByKey: Readonly<Record<FlagKey, FlagDefinition>> = Object.fromEntries(
  flagDefinitions.map((definition) => [definition.key, definition]),
) as Readonly<Record<FlagKey, FlagDefinition>>;

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
): string => `${toggle.flagKey}:${toggle.from}:${toggle.to}`;
