import { isRecord } from "../dependency-catalog/record-fields.ts";
import { repositoryRelative } from "./repository-path.ts";

interface ComponentsConfig {
  readonly file: string;
  readonly config: unknown;
}

const partsOwner = "libs/ui/components.json";

const approvedRegistries: Readonly<Record<string, string>> = {
  "@react-bits": "https://reactbits.dev/r/{name}.json",
};

const configModules: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../../../{apps,libs,infra,tools}/*/components.json",
  { eager: true, import: "default" },
);

const componentsConfigs: readonly ComponentsConfig[] = Object.entries(configModules).map(
  ([key, config]: readonly [string, unknown]) => ({ config, file: repositoryRelative(key) }),
);

const registriesOf = (config: unknown): unknown => {
  return isRecord(config)
    ? Object.getOwnPropertyDescriptor(config, "registries")?.value
    : undefined;
};

const registryViolations = (configs: readonly ComponentsConfig[]): string[] => {
  return configs.flatMap(({ config, file }) => {
    const registries = registriesOf(config);
    if (registries === undefined) {
      return [];
    }
    if (!isRecord(registries)) {
      return [`${file}: registries は namespace から URL への対応表で書いてください。`];
    }
    return Object.entries(registries).flatMap(([namespace, source]) => {
      if (file !== partsOwner) {
        return [
          `${file}: ${namespace} の部品はアプリに直接追加できません。${partsOwner} の registries から libs/ui に追加し、@repo/ui 経由で使ってください。`,
        ];
      }
      if (approvedRegistries[namespace] !== source) {
        return [
          `${file}: ${namespace} (${String(source)}) は採用済みの registry ではありません。${Object.entries(
            approvedRegistries,
          )
            .map(([approved, url]) => `${approved} (${url})`)
            .join("、")} から追加してください。`,
        ];
      }
      return [];
    });
  });
};

export { approvedRegistries, componentsConfigs, registryViolations };
