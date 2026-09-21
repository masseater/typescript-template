import { homedir, userInfo } from "node:os";

import { Effect, FileSystem, Path, PlatformError } from "effect";

import { failure } from "./failure.ts";
import { isNotFound, withFileSystem } from "./platform.ts";

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

function programArguments(root: string): Effect.Effect<readonly string[], never, Path.Path> {
  return Effect.gen(function* programArgumentsProgram() {
    const path = yield* Path.Path;
    return [...sleepGuard, path.join(root, "runsvc.sh")];
  });
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

function plistDocument(
  service: RunnerService,
  user: string,
  home: string,
): Effect.Effect<string, never, Path.Path> {
  return Effect.gen(function* plistDocumentProgram() {
    const path = yield* Path.Path;
    const arguments_ = yield* programArguments(service.root);
    const program = arguments_.map((argument) => `      <string>${argument}</string>`).join("\n");
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
  });
}

function serviceOf(
  root: string,
): Effect.Effect<RunnerService, LocalCommandFailure, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* serviceOfProgram() {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const content = yield* fs
      .readFileString(path.join(root, ".service"))
      .pipe(Effect.mapError(() => failure("file_io_failed")));
    const plistFile = content.trim();
    const label = path.basename(plistFile, plistSuffix);
    return plistFile.endsWith(plistSuffix) && label !== ""
      ? { label, plistFile, root: path.resolve(root) }
      : yield* Effect.fail(failure("ci_runner_service_invalid"));
  });
}

function installedDocument(
  plistFile: string,
): Effect.Effect<string, LocalCommandFailure, FileSystem.FileSystem> {
  return FileSystem.FileSystem.pipe(
    Effect.flatMap((fs) =>
      fs.readFileString(plistFile).pipe(
        Effect.catchIf(
          (error): error is PlatformError.PlatformError => isNotFound(error),
          () => Effect.succeed(""),
        ),
        Effect.mapError(() => failure("file_io_failed")),
      ),
    ),
  );
}

function renderService(
  root: string,
  write: boolean,
): Effect.Effect<ServiceReport, LocalCommandFailure, FileSystem.FileSystem | Path.Path> {
  return serviceOf(root).pipe(
    Effect.flatMap((service) =>
      installedDocument(service.plistFile).pipe(
        Effect.map((installed) => ({ installed, service })),
      ),
    ),
    Effect.flatMap(({ installed, service }) =>
      plistDocument(service, userInfo().username, homedir()).pipe(
        Effect.flatMap((rendered) => {
          const changed = installed !== rendered;
          const report = {
            changed,
            label: service.label,
            plistFile: service.plistFile,
            written: write && changed,
          };
          return write && changed
            ? withFileSystem((fs) => fs.writeFileString(service.plistFile, rendered)).pipe(
                Effect.as(report),
              )
            : Effect.succeed(report);
        }),
      ),
    ),
  );
}

function ciRunner(
  args: readonly string[],
): Effect.Effect<CiRunnerReport, LocalCommandFailure, FileSystem.FileSystem | Path.Path> {
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
