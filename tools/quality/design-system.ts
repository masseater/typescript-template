// oxlint-disable-next-line import/no-nodejs-modules
import { readFileSync, statSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
import { project } from "@shadcn/lint";

const designSystemProbe = "apps/user/src/routes/probe.tsx";

const smarthrTokens: Readonly<Record<string, string>> = {
  "--danger": "#e01e5a",
  "--danger-darken": "#ca1b51",
  "--font-sans": "system-ui, sans-serif",
  "--green": "#0f7f85",
  "--grey-100": "#23221e",
  "--grey-20": "#d6d3d0",
  "--grey-30": "#c1bdb7",
  "--grey-5": "#f8f7f6",
  "--grey-6": "#f5f4f3",
  "--grey-65": "#706d65",
  "--grey-7": "#f2f1f0",
  "--grey-9": "#edebe8",
  "--grey-9-darken": "#e2dfda",
  "--layer-0": "none",
  "--layer-1": "0 1px 2px 0 var(--transparency-30)",
  "--layer-2": "0 2px 4px 1px var(--transparency-30)",
  "--layer-3": "0 4px 8px 2px var(--transparency-30)",
  "--layer-4": "0 8px 16px 4px var(--transparency-30)",
  "--leading-normal": "1.5",
  "--leading-relaxed": "1.75",
  "--leading-tight": "1.25",
  "--link": "#0071c1",
  "--link-darken": "#005ea1",
  "--main": "#0077c7",
  "--main-darken": "#0068ae",
  "--radius-lg": "8px",
  "--radius-md": "6px",
  "--radius-sm": "4px",
  "--ring": "var(--main)",
  "--text-2xl": "2rem",
  "--text-2xs": "0.6666666666666666rem",
  "--text-base": "1rem",
  "--text-lg": "1.2rem",
  "--text-sm": "0.8571428571428571rem",
  "--text-xl": "1.5rem",
  "--text-xs": "0.75rem",
  "--transparency-15": "rgba(3, 3, 2, 0.15)",
  "--transparency-30": "rgba(3, 3, 2, 0.3)",
  "--transparency-50": "rgba(3, 3, 2, 0.5)",
  "--warning-yellow": "#ffcc17",
  "--warning-yellow-darken": "#fcc500",
  "--white": "#fff",
  "--white-darken": "#f2f2f2",
};

const untouchedTokens = ["--spacing"] as const;

const declarationPattern = /(?<name>--[\w-]+)\s*:\s*(?<value>[^;}]+)[;}]/gu;

function declarations(css: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of css.matchAll(declarationPattern)) {
    const { name, value } = match.groups ?? {};
    if (name !== undefined && value !== undefined) {
      found.set(name, value.trim());
    }
  }
  return found;
}

function read(file: string): string {
  // oxlint-disable-next-line node/no-sync
  return readFileSync(file, "utf-8");
}

function stylesheetPath(): string {
  return project.themeFileFor(designSystemProbe) ?? "";
}

function stylesheetSource(): string {
  const file = stylesheetPath();
  return file === "" ? "" : read(file);
}

function designSystemComponents(): string[] {
  return [...project.componentsFor(designSystemProbe).files.keys()].toSorted();
}

const appStylesheets: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../apps/*/src/**/*.css",
);

const appModules: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../apps/*/src/**/*.{ts,tsx}",
);

const partsImport = '@import "@template/ui/styles.css"';

const sourcePattern = /@source\s+"(?<directory>[^"]+)"/gu;

function appFiles(files: Readonly<Record<string, unknown>>, app: string): string[] {
  return Object.keys(files)
    .map((key) => key.replace(/^(?:\.\.\/)+/u, ""))
    .filter((file) => file.startsWith(`${app}/`));
}

function isDirectory(target: string): boolean {
  try {
    // oxlint-disable-next-line node/no-sync
    return statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function declaredSources(css: string): string[] {
  const found: string[] = [];
  for (const match of css.matchAll(sourcePattern)) {
    const { directory } = match.groups ?? {};
    if (directory !== undefined) {
      found.push(directory);
    }
  }
  return found;
}

function sourceViolations(app: string, file: string, css: string): string[] {
  const declared = declaredSources(css);
  if (declared.length === 0) {
    return [`${file}: @source がありません。このアプリのクラスだけ生成されません。`];
  }
  return declared.flatMap((directory) => {
    const scanned = path.normalize(path.join(path.dirname(file), directory));
    if (scanned !== `${app}/src` && !scanned.startsWith(`${app}/src/`)) {
      return [
        `${file}: @source "${directory}" は ${scanned} を走査しており、${app}/src の外です。`,
      ];
    }
    return isDirectory(scanned)
      ? []
      : [`${file}: @source "${directory}" のディレクトリがありません。`];
  });
}

function linkViolations(app: string, file: string): string[] {
  const link = `${file.slice(`${app}/src/`.length)}?url`;
  return appFiles(appModules, app).some((module) => read(module).includes(link))
    ? []
    : [`${file}: ${app} のソースから ${link} で読み込まれていません。`];
}

function appStylesheetViolations(apps: readonly string[]): string[] {
  const violations: string[] = [];
  for (const app of apps) {
    const entries = appFiles(appStylesheets, app).filter((file) =>
      read(file).includes(partsImport),
    );
    if (entries.length === 0) {
      violations.push(
        `${app}: 部品を使うアプリは自分の CSS エントリで ${partsImport} を宣言してください。`,
      );
    }
    for (const file of entries) {
      violations.push(...sourceViolations(app, file, read(file)), ...linkViolations(app, file));
    }
  }
  return violations;
}

function tokenViolations(css: string): string[] {
  const declared = declarations(css);
  const drifted = Object.keys(smarthrTokens).flatMap((name) =>
    declared.get(name) === smarthrTokens[name]
      ? []
      : [
          `${name} は smarthr-ui の ${smarthrTokens[name] ?? ""} を移植した値である必要があります（現在: ${declared.get(name) ?? "未定義"}）。`,
        ],
  );
  const redefined = untouchedTokens.flatMap((name) =>
    declared.has(name)
      ? [`${name} は Tailwind CSS の既定値のままにしてください（部品の寸法が崩れます）。`]
      : [],
  );
  return [...drifted, ...redefined];
}

export {
  appStylesheetViolations,
  designSystemComponents,
  designSystemProbe,
  linkViolations,
  smarthrTokens,
  sourceViolations,
  stylesheetPath,
  stylesheetSource,
  tokenViolations,
  untouchedTokens,
};
