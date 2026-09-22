#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const fsd = new Set(["service-member", "service-admin", "internal-dashboard"]);
const sourceLike = /\.(?:[cm]?[jt]sx?|css|mjs|cjs|json)$/u;

const packages = ["apps", "libs", "tools", "infra"].flatMap((area) =>
  readdirSync(join(root, area), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ area, name: entry.name, src: join(root, area, entry.name, "src") }))
    .filter((pkg) => existsSync(pkg.src) && !(pkg.area === "apps" && fsd.has(pkg.name))),
);

const walkFiles = (directory) => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(path);
    return entry.isFile() ? [path] : [];
  });
};

const alreadyModular = (src) => {
  const children = readdirSync(src, { withFileTypes: true });
  if (children.length === 0) return true;
  const allowed = new Set(["app", "features", "shared"]);
  return children.every((entry) => {
    if (entry.isDirectory()) return allowed.has(entry.name);
    return !sourceLike.test(entry.name);
  });
};

const moveTree = (from, to) => {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (existsSync(target)) {
      throw new Error(`refusing to overwrite ${target}`);
    }
    renameSync(source, target);
  }
};

const ensureIndex = (featureDirectory) => {
  const indexTs = join(featureDirectory, "index.ts");
  const indexTsx = join(featureDirectory, "index.tsx");
  if (existsSync(indexTs) || existsSync(indexTsx)) return;
  const modules = readdirSync(featureDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.[cm]?[jt]sx?$/u.test(entry.name))
    .map((entry) => entry.name)
    .filter((name) => !/\.(?:test|spec|stories)\./u.test(name))
    .filter((name) => name !== "index.ts" && name !== "index.tsx")
    .toSorted();
  if (modules.length === 0) return;
  writeFileSync(
    indexTs,
    `${modules.map((name) => `export * from "./${name}";`).join("\n")}\n`,
  );
};

const migratePackage = (pkg) => {
  if (alreadyModular(pkg.src)) {
    console.log(`skip ${pkg.area}/${pkg.name}`);
    return [];
  }
  const staging = join(pkg.src, ".modular-staging");
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  for (const entry of readdirSync(pkg.src, { withFileTypes: true })) {
    if (entry.name === ".modular-staging") continue;
    renameSync(join(pkg.src, entry.name), join(staging, entry.name));
  }
  const feature = join(pkg.src, "features", pkg.name);
  mkdirSync(feature, { recursive: true });
  moveTree(staging, feature);
  ensureIndex(feature);
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(join(pkg.src, "app"), { recursive: true });
  mkdirSync(join(pkg.src, "shared"), { recursive: true });
  writeFileSync(join(pkg.src, "app/.gitkeep"), "");
  writeFileSync(join(pkg.src, "shared/.gitkeep"), "");
  console.log(`migrated ${pkg.area}/${pkg.name}`);
  return [[`${pkg.area}/${pkg.name}/src/`, `${pkg.area}/${pkg.name}/src/features/${pkg.name}/`]];
};

const replacements = packages.flatMap((pkg) => migratePackage(pkg));

const rewriteFile = (file) => {
  let text = readFileSync(file, "utf8");
  let changed = false;
  for (const [from, to] of replacements) {
    const marker = from; // e.g. libs/auth/src/features/auth/
    const escaped = marker.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
    const pattern = new RegExp(`${escaped}(?!features/)`, "gu");
    if (!pattern.test(text)) continue;
    text = text.replace(pattern, to);
    changed = true;
  }
  if (changed) writeFileSync(file, text);
};

const files = ["apps", "libs", "tools", "infra", "knip.ts", "vite.config.ts"]
  .flatMap((entry) => {
    const path = join(root, entry);
    if (!existsSync(path)) return [];
    if (statSync(path).isFile()) return [path];
    return walkFiles(path);
  })
  .filter((file) => /\.(?:[cm]?[jt]sx?|json|mjs|cjs)$/u.test(file));

for (const file of files) rewriteFile(file);
console.log(`rewrote ${replacements.length} path prefixes across ${files.length} files`);
