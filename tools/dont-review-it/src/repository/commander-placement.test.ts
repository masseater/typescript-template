import { applications } from "@repo/config";
import { describe, expect, it } from "vite-plus/test";

import {
  localExecutableDeployViolations,
  localExecutableName,
  localExecutablePlacementViolations,
  workspaceManifests,
} from "./dependencies.ts";

const rootManifests: Readonly<Record<string, unknown>> = import.meta.glob("../../package.json", {
  eager: true,
  import: "default",
});

const commanderPackage = `@repo/${localExecutableName}`;
const placeMessage = `${commanderPackage} は tools/${localExecutableName} に 1 つだけ置いてください。デプロイして外部の要求を受けるなら apps/ へ移してください。`;
const importMessage = `libs/ui/package.json: ${commanderPackage} は手元だけで起動する実行対象です。依存を外し、共有したい処理は libs/ へ切り出してください。`;

const commanderManifest = {
  area: "tools",
  file: `tools/${localExecutableName}/package.json`,
  manifest: { name: commanderPackage },
} as const;

const repositoryManifests = [
  ...workspaceManifests,
  { area: ".", file: "package.json", manifest: rootManifests["../../package.json"] },
];

describe("local executable placement", () => {
  it.for(["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"])(
    "rejects a workspace that imports the local executable through %s",
    (key) => {
      expect.hasAssertions();
      expect(
        localExecutablePlacementViolations([
          commanderManifest,
          {
            area: "libs",
            file: "libs/ui/package.json",
            manifest: { [key]: { [commanderPackage]: "workspace:*" }, name: "@repo/ui" },
          },
        ]),
      ).toStrictEqual([importMessage]);
    },
  );

  it("rejects leaving tools/commander", () => {
    expect.hasAssertions();
    expect(localExecutablePlacementViolations([])).toStrictEqual([placeMessage]);
    expect(
      localExecutablePlacementViolations([
        {
          area: "apps",
          file: `apps/${localExecutableName}/package.json`,
          manifest: { name: commanderPackage },
        },
      ]),
    ).toStrictEqual([placeMessage]);
    expect(
      localExecutablePlacementViolations([
        commanderManifest,
        {
          area: "apps",
          file: `apps/${localExecutableName}/package.json`,
          manifest: { name: commanderPackage },
        },
      ]),
    ).toStrictEqual([placeMessage]);
    expect(
      localExecutablePlacementViolations([
        {
          area: "tools",
          file: "tools/other/package.json",
          manifest: { name: commanderPackage },
        },
      ]),
    ).toStrictEqual([placeMessage]);
  });

  it("rejects adding the local executable to the deploy list", () => {
    expect.hasAssertions();
    expect(localExecutableDeployViolations([localExecutableName])).toStrictEqual([
      `${localExecutableName} はデプロイされて外部の要求を受ける実行対象です。apps/ へ移してください。`,
    ]);
  });

  it("keeps commander in tools while nothing imports it and it is not deployed", () => {
    expect.hasAssertions();
    expect(rootManifests["../../package.json"]).toMatchObject({ name: "typescript-template" });
    expect(localExecutablePlacementViolations([commanderManifest])).toStrictEqual([]);
    expect(localExecutablePlacementViolations(repositoryManifests)).toStrictEqual([]);
    expect(localExecutableDeployViolations(applications)).toStrictEqual([]);
  });
});
