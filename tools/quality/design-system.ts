// oxlint-disable-next-line import/no-nodejs-modules
import { readFileSync, readdirSync } from "node:fs";
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

function stylesheetPath(): string {
  return project.themeFileFor(designSystemProbe) ?? "";
}

function stylesheetSource(): string {
  const file = stylesheetPath();
  // oxlint-disable-next-line node/no-sync
  return file === "" ? "" : readFileSync(file, "utf-8");
}

function designSystemComponents(): string[] {
  return [...project.componentsFor(designSystemProbe).files.keys()].toSorted();
}

const storySuffix = ".stories.tsx";

function partsDirectory(): string {
  return project.componentsFor(designSystemProbe).dir ?? "";
}

function storyName(part: string): string {
  return part.replace(/\.tsx$/u, storySuffix);
}

function storylessParts(directory: string): string[] {
  // oxlint-disable-next-line node/no-sync
  const files = readdirSync(directory).filter((file) => file.endsWith(".tsx"));
  const stories = new Set(files.filter((file) => file.endsWith(storySuffix)));
  return files
    .filter((file) => !stories.has(file) && !stories.has(storyName(file)))
    .map(
      (file) =>
        `${file}: 部品の隣に ${storyName(file)} を置いてください。story がない部品はブラウザテストと a11y 検査を受けません。`,
    )
    .toSorted();
}

const appStylesheets: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../apps/*/src/**/*.css",
);

function appStylesheetSources(app: string): string[] {
  return (
    Object.keys(appStylesheets)
      .map((key) => key.replace(/^(?:\.\.\/)+/u, ""))
      .filter((file) => file.startsWith(`${app}/`))
      // oxlint-disable-next-line node/no-sync
      .map((file) => readFileSync(file, "utf-8"))
  );
}

function appStylesheetViolations(apps: readonly string[]): string[] {
  return apps.flatMap((app) =>
    appStylesheetSources(app).some(
      (css) => css.includes('@import "@template/ui/styles.css"') && css.includes("@source"),
    )
      ? []
      : [
          `${app}: 部品を使うアプリは自分の CSS エントリで @import "@template/ui/styles.css" と @source を宣言してください。宣言がないとこのアプリのクラスだけ生成されません。`,
        ],
  );
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
  partsDirectory,
  smarthrTokens,
  storylessParts,
  stylesheetPath,
  stylesheetSource,
  tokenViolations,
  untouchedTokens,
};
