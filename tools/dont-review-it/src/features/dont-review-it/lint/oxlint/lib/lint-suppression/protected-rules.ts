import { uniq } from "es-toolkit";

import { bareRuleNameOf } from "./suppression-directives.ts";

import type { Options } from "@oxlint/plugins";

export const GENERATED_PATHS: readonly string[] = [
  "**/dist/**",
  "**/coverage/**",
  "**/node_modules/**",
  "**/generated/**",
  "**/__snapshots__/**",
  "**/*.d.ts",
];

export const PROTECTION_SCHEMA = {
  type: "object",
  properties: {
    protectedRules: { type: "array", items: { type: "string" } },
    unprotected: {
      type: "array",
      items: {
        type: "object",
        properties: { rule: { type: "string" }, reason: { type: "string" } },
        required: ["rule"],
        additionalProperties: false,
      },
    },
    generatedPaths: { type: "array", items: { type: "string" } },
  },
  additionalProperties: false,
} as const;

type DeclaredFields = Readonly<Record<string, Options[number]>>;

const declaredFieldsIn = (ruleOptions: Readonly<Options>): DeclaredFields => {
  const [declared] = ruleOptions;
  const spelled = typeof declared === "object" && declared !== null && !Array.isArray(declared);
  return spelled ? declared : {};
};

const spelledTextsAt = ({
  fields,
  key,
}: {
  readonly fields: DeclaredFields;
  readonly key: string;
}): readonly string[] => {
  const listed = fields[key];
  if (!Array.isArray(listed)) return [];
  return listed.filter((candidate): candidate is string => typeof candidate === "string");
};

export type ProtectionDeviation = {
  readonly rule: string;
  readonly grounds: string;
};

const deviationOf = (listed: Options[number]): readonly ProtectionDeviation[] => {
  if (typeof listed !== "object" || listed === null || Array.isArray(listed)) return [];
  const { rule, reason } = listed;
  if (typeof rule !== "string" || rule === "") return [];
  return [{ rule, grounds: typeof reason === "string" ? reason.trim() : "" }];
};

const deviationsAt = (fields: DeclaredFields): readonly ProtectionDeviation[] => {
  const listed = fields.unprotected;
  return Array.isArray(listed) ? listed.flatMap(deviationOf) : [];
};

export type ProtectionSettings = {
  readonly addedRules: readonly string[];
  readonly deviations: readonly ProtectionDeviation[];
  readonly generatedPaths: readonly string[];
};

export const protectionSettingsIn = (ruleOptions: Readonly<Options>): ProtectionSettings => {
  const fields = declaredFieldsIn(ruleOptions);
  return {
    addedRules: spelledTextsAt({ fields, key: "protectedRules" }),
    deviations: deviationsAt(fields),
    generatedPaths: spelledTextsAt({ fields, key: "generatedPaths" }),
  };
};

const PROTECTED_RULES: readonly string[] = [
  "forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier",
  "forbid-restricted-target-relay--delete-the-relay",
  "forbid-declared-command-invocation--use-designated-replacement",
  "forbid-tracked-path--untrack-and-ignore",
  "require-registered-file--restore-it-at-the-registered-path",
  "no-weakened-protected-rule--register-the-exception-in-configuration",
  "forbid-generic-restriction-rule--use-the-declared-rule",
  "no-unchecked-authored-path--include-it-in-every-declared-check",
];

export const protectedRulesFrom = ({
  settings,
  keptRule,
}: {
  readonly settings: ProtectionSettings;
  readonly keptRule: string;
}): readonly string[] => {
  const lifted = new Set(
    settings.deviations
      .filter(
        (deviation) => deviation.grounds !== "" && bareRuleNameOf(deviation.rule) !== keptRule,
      )
      .map((deviation) => bareRuleNameOf(deviation.rule)),
  );
  return uniq([...PROTECTED_RULES, ...settings.addedRules, keptRule]).filter(
    (rule) => !lifted.has(bareRuleNameOf(rule)),
  );
};
