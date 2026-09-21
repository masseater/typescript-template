import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import { repositoryRoot } from "@repo/config/repository-root";
import { project } from "@shadcn/lint";

const fromRepo = (file: string): string =>
  path.isAbsolute(file) ? file : path.join(repositoryRoot, file);

const designTokens: Readonly<Record<string, string>> = {
  "--danger": "#b01d3a",
  "--danger-darken": "#931832",
  "--font-display": '"Shippori Mincho", serif',
  "--font-sans": '"Zen Kaku Gothic New", sans-serif',
  "--green": "#1c6b40",
  "--grey-100": "#1c1916",
  "--grey-20": "#b3a794",
  "--grey-30": "#8d8376",
  "--grey-5": "#f6f1e8",
  "--grey-6": "#efe9de",
  "--grey-65": "#5e574e",
  "--grey-7": "#e6dfd2",
  "--grey-9": "#d9d0c1",
  "--grey-9-darken": "#c9bfad",
  "--layer-0": "none",
  "--layer-1": "0 1px 2px 0 var(--transparency-15)",
  "--layer-2": "0 1px 2px 0 var(--transparency-15), 0 8px 16px -4px var(--transparency-30)",
  "--layer-3": "0 2px 4px 0 var(--transparency-15), 0 16px 32px -8px var(--transparency-30)",
  "--layer-4": "0 8px 12px -2px var(--transparency-15), 0 28px 48px -12px var(--transparency-50)",
  "--leading-normal": "1.5",
  "--leading-relaxed": "1.75",
  "--leading-tight": "1.25",
  "--link": "var(--grey-100)",
  "--link-darken": "#000000",
  "--main": "#9a3412",
  "--main-darken": "#7c2a0e",
  "--radius-lg": "16px",
  "--radius-md": "8px",
  "--radius-sm": "4px",
  "--ring": "var(--grey-100)",
  "--text-2xl": "2rem",
  "--text-2xs": "0.6875rem",
  "--text-3xl": "2.5rem",
  "--text-4xl": "3.5rem",
  "--text-5xl": "4.5rem",
  "--text-base": "1rem",
  "--text-lg": "1.125rem",
  "--text-sm": "0.875rem",
  "--text-xl": "1.375rem",
  "--text-xs": "0.75rem",
  "--transparency-15": "rgba(28, 25, 22, 0.15)",
  "--transparency-30": "rgba(28, 25, 22, 0.3)",
  "--transparency-50": "rgba(28, 25, 22, 0.5)",
  "--warning-yellow": "#e6b000",
  "--warning-yellow-darken": "#c89600",
  "--white": "#fffdf8",
  "--white-darken": "#f3eee4",
};

const untouchedTokens = ["--spacing"] as const;

const declarationPattern = /(?<name>--[\w-]+)\s*:\s*(?<value>[^;}]+)[;}]/gu;
const colorSchemePattern = /color-scheme:\s*(?<scheme>[\w-]+)/u;
const variablePattern = /^var\((?<name>--[\w-]+)\)$/u;
const darkMediaQuery = "(prefers-color-scheme: dark)";

type ColorSchemeName = "dark" | "light";

type ColorSchemeProbe = {
  readonly background: string;
  readonly card: string;
  readonly colorScheme: string;
  readonly foreground: string;
};

const blockEnd = (css: string, open: number): number => {
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    const char = css[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  throw new Error("unclosed CSS block");
};

const withoutMediaQueries = (css: string): string => {
  const parts: string[] = [];
  let cursor = 0;
  while (cursor < css.length) {
    const at = css.indexOf("@media", cursor);
    if (at === -1) {
      parts.push(css.slice(cursor));
      break;
    }
    parts.push(css.slice(cursor, at));
    const open = css.indexOf("{", at);
    if (open === -1) {
      throw new Error("media query missing a block");
    }
    cursor = blockEnd(css, open) + 1;
  }
  return parts.join("");
};

const mediaQueryBody = (css: string, query: string): string => {
  const marker = `@media ${query}`;
  const at = css.indexOf(marker);
  if (at === -1) {
    throw new Error(`missing @media ${query}`);
  }
  const open = css.indexOf("{", at + marker.length);
  if (open === -1) {
    throw new Error(`media query missing a block: ${query}`);
  }
  return css.slice(open + 1, blockEnd(css, open));
};

const declaredValues = (css: string): Map<string, string> => {
  const found = new Map<string, string>();
  for (const match of css.matchAll(declarationPattern)) {
    const { name, value } = match.groups ?? {};
    if (name !== undefined && value !== undefined) {
      found.set(name, value.trim());
    }
  }
  return found;
};

const declarations = (css: string): Map<string, string> => {
  return declaredValues(withoutMediaQueries(css));
};

const schemeDeclarations = (css: string, scheme: ColorSchemeName): Map<string, string> => {
  const light = declarations(css);
  return scheme === "light"
    ? light
    : new Map([...light, ...declaredValues(mediaQueryBody(css, darkMediaQuery))]);
};

const resolvedDeclaration = (
  declared: ReadonlyMap<string, string>,
  name: string,
  depth = 8,
): string => {
  const value = declared.get(name);
  if (value === undefined) {
    throw new Error(`${name} is not declared`);
  }
  const reference = variablePattern.exec(value)?.groups?.name;
  if (reference === undefined) {
    return value;
  }
  if (depth === 0) {
    throw new Error(`${name} does not resolve to a value`);
  }
  return resolvedDeclaration(declared, reference, depth - 1);
};

const appliedColorScheme = (css: string, scheme: ColorSchemeName): string => {
  const source =
    scheme === "light" ? withoutMediaQueries(css) : mediaQueryBody(css, darkMediaQuery);
  const found = colorSchemePattern.exec(source)?.groups?.scheme;
  if (found === undefined) {
    throw new Error(`${scheme} color-scheme is not declared`);
  }
  return found;
};

const colorSchemeProbe = (css: string, scheme: ColorSchemeName): ColorSchemeProbe => {
  const declared = schemeDeclarations(css, scheme);
  return {
    background: resolvedDeclaration(declared, "--background"),
    card: resolvedDeclaration(declared, "--card"),
    colorScheme: appliedColorScheme(css, scheme),
    foreground: resolvedDeclaration(declared, "--foreground"),
  };
};

const read = (file: string): string => {
  return readFileSync(fromRepo(file), "utf-8");
};

const designSystemProbe = "libs/ui/src/shared/ui/button.tsx";

const stylesheetPath = (): string => {
  return project.themeFileFor(designSystemProbe) ?? "";
};

const stylesheetSource = (): string => {
  const file = stylesheetPath();
  return file === "" ? "" : read(file);
};

const indexedComponents = (): string[] => {
  return [...project.componentsFor(designSystemProbe).files.keys()].toSorted();
};

const storySuffix = ".stories.tsx";

const designSystemComponents = (): string[] => {
  const names: string[] = [];
  for (const [name, file] of project.componentsFor(designSystemProbe).files.entries()) {
    if (!file.endsWith(storySuffix)) {
      names.push(name);
    }
  }
  return names.toSorted();
};

const partsDirectory = (): string => {
  return project.componentsFor(designSystemProbe).dir ?? "";
};

const linkPartPattern = /^const (?<name>\w+) = createLink\(/gmu;

const linkParts = (): string[] => {
  const found: string[] = [];
  for (const file of project.componentsFor(designSystemProbe).files.values()) {
    for (const match of read(file).matchAll(linkPartPattern)) {
      const { name } = match.groups ?? {};
      if (name !== undefined) {
        found.push(name);
      }
    }
  }
  return found.toSorted();
};

const appStylesheets: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../apps/*/src/**/*.css",
);

const appModules: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../apps/*/src/**/*.{ts,tsx}",
);

const partsImport = '@import "@repo/ui/styles.css"';

const sourcePattern = /@source\s+"(?<directory>[^"]+)"/gu;

const declaredSources = (css: string): string[] => {
  const found: string[] = [];
  for (const match of css.matchAll(sourcePattern)) {
    const { directory } = match.groups ?? {};
    if (directory !== undefined) {
      found.push(directory);
    }
  }
  return found;
};

const scannedDirectories = (file: string, css: string): string[] => {
  return declaredSources(css).map((directory) =>
    path.normalize(path.join(path.dirname(file), directory)),
  );
};

const isDirectory = (target: string): boolean => {
  try {
    return statSync(fromRepo(target)).isDirectory();
  } catch {
    return false;
  }
};

const sourceViolations = (app: string, file: string, css: string): string[] => {
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
};

const appFiles = (files: Readonly<Record<string, unknown>>, app: string): string[] => {
  const matched: string[] = [];
  for (const key of Object.keys(files)) {
    const file = key.replace(/^(?:\.\.\/)+/u, "");
    if (file.startsWith(`${app}/`)) {
      matched.push(file);
    }
  }
  return matched;
};

const styledFiles = (app: string): string[] => {
  const styled: string[] = [];
  for (const file of appFiles(appModules, app)) {
    if (file.endsWith(".tsx") && read(file).includes("className")) {
      styled.push(file);
    }
  }
  return styled;
};

const coverageViolations = (app: string, scanned: readonly string[]): string[] => {
  const violations: string[] = [];
  for (const file of styledFiles(app)) {
    let covered = false;
    for (const directory of scanned) {
      if (file === directory || file.startsWith(`${directory}/`)) {
        covered = true;
        break;
      }
    }
    if (!covered) {
      violations.push(
        `${file}: どの @source からも走査されていません。このファイルのクラスだけ生成されません。`,
      );
    }
  }
  return violations;
};

const linkViolations = (app: string, file: string): string[] => {
  const link = `${file.slice(`${app}/src/`.length)}?url`;
  for (const module of appFiles(appModules, app)) {
    if (read(module).includes(link)) {
      return [];
    }
  }
  return [`${file}: ${app} のソースから ${link} で読み込まれていません。`];
};

const entryViolations = (app: string, entries: readonly string[]): string[] => {
  const violations: string[] = [];
  const scanned: string[] = [];
  for (const file of entries) {
    violations.push(...sourceViolations(app, file, read(file)), ...linkViolations(app, file));
    scanned.push(...scannedDirectories(file, read(file)));
  }
  return [...violations, ...coverageViolations(app, scanned)];
};

const appStylesheetViolations = (apps: readonly string[]): string[] => {
  return apps.flatMap((app) => {
    const entries: string[] = [];
    for (const file of appFiles(appStylesheets, app)) {
      if (read(file).includes(partsImport)) {
        entries.push(file);
      }
    }
    return entries.length === 0
      ? [`${app}: 部品を使うアプリは自分の CSS エントリで ${partsImport} を宣言してください。`]
      : entryViolations(app, entries);
  });
};

const tokenViolations = (css: string): string[] => {
  const declared = declarations(css);
  const drifted = Object.keys(designTokens).flatMap((name) =>
    declared.get(name) === designTokens[name]
      ? []
      : [
          `${name} は設計トークン表の ${designTokens[name] ?? ""} である必要があります（現在: ${declared.get(name) ?? "未定義"}）。`,
        ],
  );
  const redefined = untouchedTokens.flatMap((name) =>
    declared.has(name)
      ? [`${name} は Tailwind CSS の既定値のままにしてください（部品の寸法が崩れます）。`]
      : [],
  );
  return [...drifted, ...redefined];
};

export {
  appStylesheetViolations,
  colorSchemeProbe,
  indexedComponents,
  coverageViolations,
  designSystemComponents,
  declarations,
  designSystemProbe,
  designTokens,
  linkParts,
  linkViolations,
  partsDirectory,
  sourceViolations,
  stylesheetPath,
  stylesheetSource,
  tokenViolations,
  untouchedTokens,
};
