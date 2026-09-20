import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { homedir, tmpdir, userInfo } from "node:os";
import path from "node:path";

import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { ciRunner } from "./ci-runner.ts";

async function runnerDirectory(label: string): Promise<{ plistFile: string; root: string }> {
  const base = await mkdtemp(path.join(tmpdir(), "ci-runner-"));
  const plistFile = path.join(base, `${label}.plist`);
  await writeFile(path.join(base, ".service"), `${plistFile}\n`, "utf-8");
  return { plistFile, root: base };
}

describe("the ci runner service document", () => {
  it("reports the change without touching the file", async () => {
    expect.hasAssertions();
    const { plistFile, root } = await runnerDirectory("reported.only");
    const report = await Effect.runPromise(ciRunner([root]));
    expect(report.written).toBe(false);
    expect(report.services).toStrictEqual([
      { changed: true, label: "reported.only", plistFile, written: false },
    ]);
    await expect(readFile(plistFile, "utf-8")).rejects.toThrow("ENOENT");
  });

  it("runs the runner service under caffeinate", async () => {
    expect.hasAssertions();
    const { plistFile, root } = await runnerDirectory("written.service");
    const report = await Effect.runPromise(ciRunner([root, "--write"]));
    expect(report.services).toStrictEqual([
      { changed: true, label: "written.service", plistFile, written: true },
    ]);
    const document = await readFile(plistFile, "utf-8");
    expect(document).toContain(
      `    <array>\n      <string>/usr/bin/caffeinate</string>\n      <string>-s</string>\n      <string>${path.join(root, "runsvc.sh")}</string>\n    </array>`,
    );
  });

  it("names the service, its account and its logs", async () => {
    expect.hasAssertions();
    const { plistFile, root } = await runnerDirectory("named.service");
    await Effect.runPromise(ciRunner([root, "--write"]));
    const document = await readFile(plistFile, "utf-8");
    expect(document).toContain("<string>named.service</string>");
    expect(document).toContain(`<string>${userInfo().username}</string>`);
    expect(document).toContain(`<string>${root}</string>`);
    expect(document).toContain(
      `<string>${path.join(homedir(), "Library/Logs/named.service/stdout.log")}</string>`,
    );
  });

  it("leaves a service that already runs under caffeinate alone", async () => {
    expect.hasAssertions();
    const { plistFile, root } = await runnerDirectory("settled.service");
    await Effect.runPromise(ciRunner([root, "--write"]));
    const report = await Effect.runPromise(ciRunner([root, "--write"]));
    expect(report.services).toStrictEqual([
      { changed: false, label: "settled.service", plistFile, written: false },
    ]);
  });
});

describe("a ci runner directory the command cannot read", () => {
  it("refuses to guess which runner to render", async () => {
    expect.hasAssertions();
    const failed = await Effect.runPromise(Effect.flip(ciRunner([])));
    expect(failed.reason).toBe("ci_runner_root_required");
  });

  it("refuses a runner directory that names no service", async () => {
    expect.hasAssertions();
    const base = await mkdtemp(path.join(tmpdir(), "ci-runner-bare-"));
    const failed = await Effect.runPromise(Effect.flip(ciRunner([base])));
    expect(failed.reason).toBe("file_io_failed");
  });
});
