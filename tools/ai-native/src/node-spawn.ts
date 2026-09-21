type ChildStream = {
  on: (event: string, listener: (emission: Buffer) => void) => ChildStream;
  once: (event: string, listener: (emission: Buffer) => void) => ChildStream;
  pipe: (destination: unknown, options?: { end?: boolean }) => ChildStream;
};

type SpawnLaunch = {
  readonly executable: string;
  readonly handed?: readonly string[];
  readonly spawnOptions?: {
    readonly cwd?: string;
    readonly detached?: boolean;
    readonly encoding?: BufferEncoding;
    readonly env?: NodeJS.ProcessEnv;
    readonly input?: string;
    readonly maxBuffer?: number;
    readonly stdio?: "inherit" | "ignore" | readonly (string | number)[];
    readonly windowsHide?: boolean;
  };
};

const spawnedProcessApi = process.getBuiltinModule("child_process");

type NodeChild = ReturnType<typeof spawnedProcessApi.spawn>;

type SpawnedChild = {
  readonly exitCode: NodeChild["exitCode"];
  readonly pid: NodeChild["pid"];
  readonly signalCode: NodeChild["signalCode"];
  readonly stderr: ChildStream | null;
  readonly stdout: ChildStream | null;
  kill: NodeChild["kill"];
  once: NodeChild["once"];
};

type NodeSpawnOptions = Parameters<typeof spawnedProcessApi.spawn>[2];

const asChildStream = (stream: NodeChild["stdout"]): ChildStream | null =>
  stream === null ? null : (stream as ChildStream);

const spawnChild = (launch: SpawnLaunch): SpawnedChild => {
  const child = spawnedProcessApi.spawn(
    launch.executable,
    [...(launch.handed ?? [])],
    launch.spawnOptions as NodeSpawnOptions,
  );
  return {
    get exitCode() {
      return child.exitCode;
    },
    get pid() {
      return child.pid;
    },
    get signalCode() {
      return child.signalCode;
    },
    get stderr() {
      return asChildStream(child.stderr);
    },
    get stdout() {
      return asChildStream(child.stdout);
    },
    kill: child.kill.bind(child),
    once: child.once.bind(child),
  };
};

const printedOutput = (printed: string | Buffer): string =>
  typeof printed === "string" ? printed : Buffer.from(printed).toString("utf8");

const spawnChildSync = (
  launch: SpawnLaunch,
): {
  readonly error?: Error | undefined;
  readonly status: number | null;
  readonly stderr: string;
  readonly stdout: string;
} => {
  const exit = spawnedProcessApi.spawnSync(
    launch.executable,
    [...(launch.handed ?? [])],
    launch.spawnOptions as NodeSpawnOptions,
  );
  return {
    error: exit.error,
    status: exit.status,
    stderr: printedOutput(exit.stderr),
    stdout: printedOutput(exit.stdout),
  };
};

export { spawnChild, spawnChildSync };
export type { SpawnedChild };
