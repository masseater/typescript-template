import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { expect } from "vite-plus/test";

import { defaultRequiredFileFormConfig } from "../src/features/dont-review-it/required-file-form/config.ts";
import { runRequiredFileFormChecks } from "../src/features/dont-review-it/required-file-form/run-required-file-form-checks.ts";

const scannedFor = ({
  files,
  links,
}: {
  readonly files: Readonly<Record<string, string>>;
  readonly links?: Readonly<Record<string, string>>;
}) =>
  Effect.gen(function* scannedFor() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
      prefix: "dont-review-it-required-file-form-",
    });
    yield* Effect.forEach(
      Object.entries(files),
      ([fileName, source]) =>
        Effect.gen(function* writeFixture() {
          const absolutePath = paths.join(repositoryRoot, fileName);
          yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
          yield* filesystem.writeFileString(absolutePath, source);
        }),
      { discard: true },
    );
    yield* Effect.forEach(
      Object.entries(links ?? {}),
      ([fileName, pointsAt]) => filesystem.symlink(pointsAt, paths.join(repositoryRoot, fileName)),
      { discard: true },
    );
    return yield* runRequiredFileFormChecks({
      repositoryRoot,
      config: defaultRequiredFileFormConfig,
    });
  });

layer(NodeServices.layer)("必須ファイルの形の検査", (it) => {
  it.effect("JSON で置かれた knip の設定を、TypeScript の綴りを名指しして報告する", () =>
    Effect.gen(function* program() {
      const scanned = yield* scannedFor({ files: { "knip.json": `{}\n` } });

      expect(scanned.problems).toStrictEqual([
        {
          file: "knip.json",
          line: null,
          message:
            "A configuration for knip must not stay in a format the type checker never reads. Move what it declares into knip.ts.",
        },
      ]);
    }),
  );

  it.effect("JSON で置かれた oxlint の設定を、ツールチェーン設定へ移す指示とともに報告する", () =>
    Effect.gen(function* program() {
      const scanned = yield* scannedFor({ files: { ".oxlintrc.jsonc": `{}\n` } });

      expect(scanned.problems).toStrictEqual([
        {
          file: ".oxlintrc.jsonc",
          line: null,
          message:
            "A configuration for oxlint must not stay in a format the type checker never reads. Move what it declares into vite.config.ts.",
        },
      ]);
    }),
  );

  it.effect("旧来の rc 形式で置かれた eslint の設定を報告する", () =>
    Effect.gen(function* program() {
      const scanned = yield* scannedFor({ files: { ".eslintrc.yml": `root: true\n` } });

      expect(scanned.problems).toStrictEqual([
        {
          file: ".eslintrc.yml",
          line: null,
          message:
            "A configuration for eslint must not stay in a format the type checker never reads. Move what it declares into eslint.config.ts.",
        },
      ]);
    }),
  );

  it.effect("JavaScript で置かれた vite の設定を報告する", () =>
    Effect.gen(function* program() {
      const scanned = yield* scannedFor({ files: { "vite.config.mjs": `export default {};\n` } });

      expect(scanned.problems).toStrictEqual([
        {
          file: "vite.config.mjs",
          line: null,
          message:
            "A configuration for vite must not stay in a format the type checker never reads. Move what it declares into vite.config.ts.",
        },
      ]);
    }),
  );

  it.effect(
    "リポジトリの根だけでなく、マニフェストを持つディレクトリに置かれた設定も報告する",
    () =>
      Effect.gen(function* program() {
        const scanned = yield* scannedFor({
          files: {
            "package.json": `{"name": "root"}`,
            "packages/web/package.json": `{"name": "web"}`,
            "packages/web/vite.config.js": `export default {};\n`,
          },
        });

        expect(scanned.problems).toStrictEqual([
          {
            file: "packages/web/vite.config.js",
            line: null,
            message:
              "A configuration for vite must not stay in a format the type checker never reads. Move what it declares into vite.config.ts.",
          },
        ]);
      }),
  );

  it.effect("TypeScript で書かれた設定を報告しない", () =>
    Effect.gen(function* program() {
      const scanned = yield* scannedFor({
        files: {
          "knip.ts": `export default {};\n`,
          "vite.config.ts": `export default {};\n`,
          "eslint.config.ts": `export default [];\n`,
        },
      });

      expect(scanned.problems).toStrictEqual([]);
    }),
  );

  it.effect("AGENTS.md を持つディレクトリに CLAUDE.md が無いことを報告する", () =>
    Effect.gen(function* program() {
      const scanned = yield* scannedFor({ files: { "AGENTS.md": "# rules\n" } });

      expect(scanned.problems).toStrictEqual([
        {
          file: "CLAUDE.md",
          line: null,
          message:
            "A directory that instructs agents must not leave the second name unreachable. Create it here as a symbolic link to AGENTS.md.",
        },
      ]);
    }),
  );

  it.effect("CLAUDE.md が中身を持つ実体ファイルであることを報告する", () =>
    Effect.gen(function* program() {
      const scanned = yield* scannedFor({
        files: { "AGENTS.md": "# rules\n", "CLAUDE.md": "# rules\n" },
      });

      expect(scanned.problems).toStrictEqual([
        {
          file: "CLAUDE.md",
          line: null,
          message:
            "Agent instructions must not be spelled twice. Replace this file with a symbolic link to AGENTS.md.",
        },
      ]);
    }),
  );

  it.effect("CLAUDE.md が AGENTS.md 以外を指すシンボリックリンクであることを報告する", () =>
    Effect.gen(function* program() {
      const scanned = yield* scannedFor({
        files: { "AGENTS.md": "# rules\n", "README.md": "# readme\n" },
        links: { "CLAUDE.md": "README.md" },
      });

      expect(scanned.problems).toStrictEqual([
        {
          file: "CLAUDE.md",
          line: null,
          message:
            "Agent instructions must not be spelled twice. Replace this file with a symbolic link to AGENTS.md.",
        },
      ]);
    }),
  );

  it.effect("CLAUDE.md だけがあって AGENTS.md が無いことを報告する", () =>
    Effect.gen(function* program() {
      const scanned = yield* scannedFor({
        files: { "README.md": "# readme\n" },
        links: { "CLAUDE.md": "AGENTS.md" },
      });

      expect(scanned.problems).toStrictEqual([
        {
          file: "AGENTS.md",
          line: null,
          message:
            "Agent instructions must not live under CLAUDE.md alone. Write them here and leave CLAUDE.md pointing at this file.",
        },
      ]);
    }),
  );

  it.effect("AGENTS.md を指すシンボリックリンクの CLAUDE.md を報告しない", () =>
    Effect.gen(function* program() {
      const scanned = yield* scannedFor({
        files: { "AGENTS.md": "# rules\n" },
        links: { "CLAUDE.md": "AGENTS.md" },
      });

      expect(scanned.problems).toStrictEqual([]);
    }),
  );

  it.effect("どちらの指示ファイルも無いディレクトリを報告しない", () =>
    Effect.gen(function* program() {
      const scanned = yield* scannedFor({ files: { "README.md": "# readme\n" } });

      expect(scanned.problems).toStrictEqual([]);
    }),
  );

  it.effect("マニフェストを 1 つも持たないリポジトリでも、根を開いた対象として数える", () =>
    Effect.gen(function* program() {
      const scanned = yield* scannedFor({ files: { "README.md": "# empty\n" } });

      expect(scanned.scanned).toBe(1);
    }),
  );
});
