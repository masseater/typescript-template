import { describe, expect, it } from "vite-plus/test";
// oxlint-disable-next-line import/no-nodejs-modules
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { loadArtifacts } from "./artifacts.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";

interface UserBuild {
  readonly client: string;
  readonly root: string;
  readonly server: string;
}

async function withTemporaryRoot(run: (root: string) => Promise<void>): Promise<void> {
  const temporary = await mkdtemp(path.join(tmpdir(), "template-artifacts-"));
  const root = await realpath(temporary);
  try {
    await run(root);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

async function writeFiles(
  directory: string,
  contents: Readonly<Record<string, string>>,
): Promise<void> {
  await Promise.all(
    Object.entries(contents).map(async ([name, content]: readonly [string, string]) => {
      const filename = path.join(directory, name);
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(filename, content);
    }),
  );
}

async function writeUserBuild(root: string): Promise<UserBuild> {
  const client = path.join(root, "apps/user/dist/client");
  const server = path.join(root, "apps/user/dist/server");
  await writeFiles(client, {
    "app.js": "export const publicValue = 1;",
    "app.js.map": "private source map",
    "styles.css": "body{color:red}",
  });
  await writeFiles(server, {
    ".dev.vars": "AUTH_SECRET=private",
    ".env.production": "AUTH_SECRET=private",
    ".vite/manifest.json": "{}",
    "chunks/handler.js": "export default {};",
    "index.js": 'export { default } from "./chunks/handler.js";',
    "styles.css": "body{color:red}",
  });
  return { client, root, server };
}

async function withUserBuild(run: (build: UserBuild) => Promise<void>): Promise<void> {
  await withTemporaryRoot(async (root) => {
    await run(await writeUserBuild(root));
  });
}

describe("worker artifact staging", () => {
  it("uploads server chunks with their source maps but excludes private client source maps", async () => {
    expect.hasAssertions();
    await withUserBuild(async ({ client, root, server }) => {
      await writeFiles(server, { "index.js.map": "{}", "orphan.js.map": "{}" });
      const artifacts = await loadArtifacts(root, "user");
      expect(artifacts.modules).toStrictEqual([
        {
          contentFile: path.join(server, "chunks/handler.js"),
          contentType: "application/javascript+module",
          name: "chunks/handler.js",
        },
        {
          contentFile: path.join(server, "index.js"),
          contentType: "application/javascript+module",
          name: "index.js",
        },
        {
          contentFile: path.join(server, "index.js.map"),
          contentType: "application/source-map",
          name: "index.js.map",
        },
      ]);
      expect(artifacts.release).toMatch(/^[0-9a-f]{16}$/u);
      await expect(readdir(artifacts.clientDirectory)).resolves.toStrictEqual([
        "app.js",
        "styles.css",
      ]);
      await expect(readFile(path.join(client, "app.js.map"), "utf-8")).resolves.toBe(
        "private source map",
      );
    });
  });

  it("reuses the staging directory for unchanged client content", async () => {
    expect.hasAssertions();
    await withUserBuild(async ({ root }) => {
      const first = await loadArtifacts(root, "user");
      const second = await loadArtifacts(root, "user");
      expect(second.clientDirectory).toBe(first.clientDirectory);
    });
  });
});

describe("worker artifact integrity", () => {
  it("refuses server CSS that differs from its public asset", async () => {
    expect.hasAssertions();
    await withUserBuild(async ({ root, server }) => {
      await writeFile(path.join(server, "styles.css"), "body{color:blue}");
      await expect(loadArtifacts(root, "user")).rejects.toThrow("server_css_without_public_asset");
    });
  });

  it("never writes through a link placed in the staging directory", async () => {
    expect.hasAssertions();
    await withUserBuild(async ({ root }) => {
      const artifacts = await loadArtifacts(root, "user");
      const protectedFile = path.join(root, "protected.txt");
      await writeFile(protectedFile, "do not overwrite");
      await unlink(path.join(artifacts.clientDirectory, "app.js"));
      await symlink(protectedFile, path.join(artifacts.clientDirectory, "app.js"));
      await expect(loadArtifacts(root, "user")).rejects.toThrow("artifact_staging_link_forbidden");
      await expect(readFile(protectedFile, "utf-8")).resolves.toBe("do not overwrite");
    });
  });

  it("stages changed client content in a new directory", async () => {
    expect.hasAssertions();
    await withUserBuild(async ({ client, root }) => {
      const first = await loadArtifacts(root, "user");
      await writeFile(path.join(client, "app.js"), "export const publicValue = 2;");
      const second = await loadArtifacts(root, "user");
      expect(second.clientDirectory).not.toBe(first.clientDirectory);
      expect(second.release).not.toBe(first.release);
    });
  });

  it("derives the release from code and client content but not from source maps", async () => {
    expect.hasAssertions();
    await withUserBuild(async ({ root, server }) => {
      await writeFiles(server, { "index.js.map": "{}" });
      const first = await loadArtifacts(root, "user");
      await writeFile(path.join(server, "index.js.map"), '{"version":3}');
      const mapChanged = await loadArtifacts(root, "user");
      await writeFile(path.join(server, "chunks/handler.js"), "export default { changed: true };");
      const codeChanged = await loadArtifacts(root, "user");
      expect(mapChanged.release).toBe(first.release);
      expect(codeChanged.release).not.toBe(first.release);
    });
  });
});

describe("private artifact refusal", () => {
  it.each([
    ".dev.vars",
    ".dev.vars.production",
    ".env",
    ".env.production",
    ".env-backup",
    "wrangler.json",
    "private.key",
    ".git/config",
    ".vite/manifest.json",
    "Pulumi.production.yaml",
  ])("refuses private client artifact %s before copying anything", async (filename) => {
    expect.hasAssertions();
    await withTemporaryRoot(async (root) => {
      const client = path.join(root, "apps/user/dist/client");
      const server = path.join(root, "apps/user/dist/server");
      await mkdir(path.dirname(path.join(client, filename)), { recursive: true });
      await mkdir(server, { recursive: true });
      await writeFile(path.join(client, filename), "private");
      await writeFile(path.join(server, "index.js"), "export default {};");
      await expect(loadArtifacts(root, "user")).rejects.toThrow("private_client_artifact");
    });
  });

  it("refuses symlinks in upload roots", async () => {
    expect.hasAssertions();
    await withTemporaryRoot(async (root) => {
      const dist = path.join(root, "apps/admin/dist");
      await mkdir(path.join(dist, "server"), { recursive: true });
      await mkdir(path.join(root, "private"));
      await symlink(path.join(root, "private"), path.join(dist, "client"));
      await expect(loadArtifacts(root, "admin")).rejects.toThrow(
        "artifact_directory_symlink_forbidden",
      );
    });
  });
});
