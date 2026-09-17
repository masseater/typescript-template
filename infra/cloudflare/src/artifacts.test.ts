import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vite-plus/test";
import { loadArtifacts } from "./artifacts.ts";

test("uploads server chunks with their source maps but excludes private client source maps", async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "template-artifacts-")));
  try {
    const client = path.join(root, "apps/user/dist/client");
    const server = path.join(root, "apps/user/dist/server");
    await mkdir(client, { recursive: true });
    await mkdir(path.join(server, "chunks"), { recursive: true });
    await writeFile(path.join(client, "app.js"), "export const publicValue = 1;");
    await writeFile(path.join(client, "app.js.map"), "private source map");
    await writeFile(path.join(server, ".dev.vars"), "AUTH_SECRET=private");
    await writeFile(path.join(server, ".env.production"), "AUTH_SECRET=private");
    await mkdir(path.join(server, ".vite"));
    await writeFile(path.join(server, ".vite", "manifest.json"), "{}");
    await writeFile(path.join(client, "styles.css"), "body{color:red}");
    await writeFile(path.join(server, "styles.css"), "body{color:red}");
    await writeFile(
      path.join(server, "index.js"),
      'export { default } from "./chunks/handler.js";',
    );
    await writeFile(path.join(server, "chunks/handler.js"), "export default {};");
    await writeFile(path.join(server, "index.js.map"), "{}");
    await writeFile(path.join(server, "orphan.js.map"), "{}");
    const artifacts = await loadArtifacts(root, "user");
    expect(artifacts.modules).toStrictEqual([
      {
        name: "chunks/handler.js",
        contentFile: path.join(server, "chunks/handler.js"),
        contentType: "application/javascript+module",
      },
      {
        name: "index.js",
        contentFile: path.join(server, "index.js"),
        contentType: "application/javascript+module",
      },
      {
        name: "index.js.map",
        contentFile: path.join(server, "index.js.map"),
        contentType: "application/source-map",
      },
    ]);
    expect(artifacts.release).toMatch(/^[0-9a-f]{16}$/);
    expect(await readdir(artifacts.clientDirectory)).toEqual(["app.js", "styles.css"]);
    expect(await readFile(path.join(client, "app.js.map"), "utf8")).toBe("private source map");
    expect((await loadArtifacts(root, "user")).clientDirectory).toBe(artifacts.clientDirectory);
    await writeFile(path.join(server, "styles.css"), "body{color:blue}");
    await expect(loadArtifacts(root, "user")).rejects.toThrow("server_css_without_public_asset");
    await writeFile(path.join(server, "styles.css"), "body{color:red}");
    const protectedFile = path.join(root, "protected.txt");
    await writeFile(protectedFile, "do not overwrite");
    await unlink(path.join(artifacts.clientDirectory, "app.js"));
    await symlink(protectedFile, path.join(artifacts.clientDirectory, "app.js"));
    await expect(loadArtifacts(root, "user")).rejects.toThrow("artifact_staging_link_forbidden");
    expect(await readFile(protectedFile, "utf8")).toBe("do not overwrite");
    await writeFile(path.join(client, "app.js"), "export const publicValue = 2;");
    const changedClient = await loadArtifacts(root, "user");
    expect(changedClient.clientDirectory).not.toBe(artifacts.clientDirectory);
    expect(changedClient.release).not.toBe(artifacts.release);
    await writeFile(path.join(server, "index.js.map"), '{"version":3}');
    expect((await loadArtifacts(root, "user")).release).toBe(changedClient.release);
    await writeFile(path.join(server, "chunks/handler.js"), "export default { changed: true };");
    expect((await loadArtifacts(root, "user")).release).not.toBe(changedClient.release);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test.each([
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
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "template-artifacts-")));
  try {
    const client = path.join(root, "apps/user/dist/client");
    const server = path.join(root, "apps/user/dist/server");
    await mkdir(path.dirname(path.join(client, filename)), { recursive: true });
    await mkdir(server, { recursive: true });
    await writeFile(path.join(client, filename), "private");
    await writeFile(path.join(server, "index.js"), "export default {};");
    await expect(loadArtifacts(root, "user")).rejects.toThrow("private_client_artifact");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("refuses symlinks in upload roots", async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "template-artifacts-")));
  try {
    const dist = path.join(root, "apps/admin/dist");
    await mkdir(path.join(dist, "server"), { recursive: true });
    await mkdir(path.join(root, "private"));
    await symlink(path.join(root, "private"), path.join(dist, "client"));
    await expect(loadArtifacts(root, "admin")).rejects.toThrow(
      "artifact_directory_symlink_forbidden",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
