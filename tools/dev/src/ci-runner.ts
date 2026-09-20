// oxlint-disable-next-line import/no-nodejs-modules
import { readFile, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { homedir, userInfo } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { Effect, Predicate } from "effect";

import { failure, fileIo } from "./failure.ts";

import type { LocalCommandFailure } from "./failure.ts";

interface RunnerService {
  readonly label: string;
  readonly plistFile: string;
  readonly root: string;
}

interface ServiceReport {
  readonly changed: boolean;
  readonly label: string;
  readonly plistFile: string;
  readonly written: boolean;
}

interface CiRunnerReport {
  readonly event: "local.ci_runner_services_rendered";
  readonly ok: true;
  readonly services: readonly ServiceReport[];
  readonly written: boolean;
}

const sleepGuard = ["/usr/bin/caffeinate", "-s"] as const;
const writeFlag = "--write";
const plistSuffix = ".plist";

function programArguments(root: string): readonly string[] {
  return [...sleepGuard, path.join(root, "runsvc.sh")];
}

const plistOpening = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>`;

const plistClosing = `    <key>EnvironmentVariables</key>
    <dict>
      <key>ACTIONS_RUNNER_SVC</key>
      <string>1</string>
    </dict>
    <key>ProcessType</key>
    <string>Interactive</string>
    <key>SessionCreate</key>
    <true/>
  </dict>
</plist>
`;

function plistDocument(service: RunnerService, user: string, home: string): string {
  const program = programArguments(service.root)
    .map((argument) => `      <string>${argument}</string>`)
    .join("\n");
  const logDirectory = path.join(home, "Library", "Logs", service.label);
  return `${plistOpening}
    <key>Label</key>
    <string>${service.label}</string>
    <key>ProgramArguments</key>
    <array>
${program}
    </array>
    <key>UserName</key>
    <string>${user}</string>
    <key>WorkingDirectory</key>
    <string>${service.root}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${path.join(logDirectory, "stdout.log")}</string>
    <key>StandardErrorPath</key>
    <string>${path.join(logDirectory, "stderr.log")}</string>
${plistClosing}`;
}

function serviceOf(root: string): Effect.Effect<RunnerService, LocalCommandFailure> {
  return fileIo(async () => readFile(path.join(root, ".service"), "utf-8")).pipe(
    Effect.flatMap((content) => {
      const plistFile = content.trim();
      const label = path.basename(plistFile, plistSuffix);
      return plistFile.endsWith(plistSuffix) && label !== ""
        ? Effect.succeed({ label, plistFile, root: path.resolve(root) })
        : Effect.fail(failure("ci_runner_service_invalid"));
    }),
  );
}

function isMissing(cause: unknown): boolean {
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT";
}

function installedDocument(plistFile: string): Effect.Effect<string, LocalCommandFailure> {
  return Effect.tryPromise({
    catch: () => failure("file_io_failed"),
    try: async () => {
      try {
        return await readFile(plistFile, "utf-8");
      } catch (cause) {
        if (isMissing(cause)) {
          return "";
        }
        throw cause;
      }
    },
  });
}

function renderService(
  root: string,
  write: boolean,
): Effect.Effect<ServiceReport, LocalCommandFailure> {
  return serviceOf(root).pipe(
    Effect.flatMap((service) =>
      installedDocument(service.plistFile).pipe(
        Effect.map((installed) => ({ installed, service })),
      ),
    ),
    Effect.flatMap(({ installed, service }) => {
      const rendered = plistDocument(service, userInfo().username, homedir());
      const changed = installed !== rendered;
      const report = {
        changed,
        label: service.label,
        plistFile: service.plistFile,
        written: write && changed,
      };
      return write && changed
        ? fileIo(async () => writeFile(service.plistFile, rendered, "utf-8")).pipe(
            Effect.as(report),
          )
        : Effect.succeed(report);
    }),
  );
}

function ciRunner(args: readonly string[]): Effect.Effect<CiRunnerReport, LocalCommandFailure> {
  const write = args.includes(writeFlag);
  const roots = args.filter((argument) => argument !== writeFlag);
  return roots.length === 0
    ? Effect.fail(failure("ci_runner_root_required"))
    : Effect.forEach(roots, (root) => renderService(root, write)).pipe(
        Effect.map((services) => ({
          event: "local.ci_runner_services_rendered" as const,
          ok: true as const,
          services,
          written: write,
        })),
      );
}

export { ciRunner };
