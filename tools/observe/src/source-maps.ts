import { readdir, readFile } from "node:fs/promises";
import { SourceMap } from "node:module";
import path from "node:path";
import type { Application } from "@template/config";
import * as v from "valibot";

const payload = v.looseObject({
  version: v.literal(3),
  sources: v.array(v.string()),
  names: v.array(v.string()),
  mappings: v.string(),
});

async function findMap(directory: string, filename: string): Promise<string | undefined> {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  });
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === `${filename}.map`) return candidate;
    if (entry.isDirectory()) {
      const nested = await findMap(candidate, filename);
      if (nested) return nested;
    }
  }
  return undefined;
}

export async function symbolicate(
  repositoryRoot: string,
  app: Application,
  release: string,
  locations: readonly string[],
) {
  const releaseDirectory = path.join(
    repositoryRoot,
    ".local",
    "source-maps",
    app,
    "releases",
    release,
  );
  return Promise.all(
    locations.map(async (location) => {
      const match = /^(\/assets\/)?([\w.-]+\.[cm]?[jt]sx?):(\d+):(\d+)$/.exec(location);
      if (!match?.[2]) return { location, resolved: false as const, reason: "location_invalid" };
      const [, client, filename, line, column] = match;
      const runtimes = client ? (["client"] as const) : (["server", "client"] as const);
      for (const runtime of runtimes) {
        const runtimeDirectory = path.join(releaseDirectory, runtime);
        const mapFile = await findMap(runtimeDirectory, filename);
        if (!mapFile) continue;
        const parsed = v.parse(payload, JSON.parse(await readFile(mapFile, "utf8")));
        const map = new SourceMap({
          file: filename,
          sourceRoot: "",
          sourcesContent: [],
          version: parsed.version,
          sources: parsed.sources,
          names: parsed.names,
          mappings: parsed.mappings,
        });
        const lineNumber = Number(line);
        const columnNumber = Number(column);
        const entry = map.findEntry(lineNumber - 1, columnNumber - 1);
        if (!("generatedLine" in entry) || entry.generatedLine !== lineNumber - 1)
          return { location, resolved: false as const, reason: "mapping_missing" };
        const origin = map.findOrigin(lineNumber, columnNumber);
        if (!("fileName" in origin))
          return { location, resolved: false as const, reason: "mapping_missing" };
        const builtFile = path.join(
          repositoryRoot,
          "apps",
          app,
          "dist",
          runtime,
          path.relative(runtimeDirectory, mapFile),
        );
        return {
          location,
          resolved: true as const,
          source: path
            .relative(repositoryRoot, path.resolve(path.dirname(builtFile), origin.fileName))
            .replaceAll(path.sep, "/"),
          line: origin.lineNumber,
          column: origin.columnNumber,
          ...(origin.name ? { name: origin.name } : {}),
        };
      }
      return { location, resolved: false as const, reason: "source_map_missing" };
    }),
  );
}
