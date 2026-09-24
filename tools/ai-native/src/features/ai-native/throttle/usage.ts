export type Invocation = {
  timeoutSec: number;
  executable: string;
  args: readonly string[];
  commandLine: string;
};

const USAGE = `Usage: throttle [--timeout <seconds>] -- <command> [args...]

Runs the command while keeping the number of simultaneous executions that
share this host and namespace at or below the limit. When every slot is held
the wrapper joins a wait queue, reports its position on stderr, and retries
every slot on each poll, for at most the wait budget. The operating system
releases a slot when its holder exits, including an abrupt termination. Do
not nest throttle inside a command it wraps: the inner call counts
as one more competitor and consumes a second slot.

When the command exits, throttle ends the rest of its process group before
it gives the slot back: SIGTERM first, then SIGKILL after the grace period.

Options:
  --timeout <seconds>  Stop the command's whole process tree after this many
                       seconds. POSIX sends SIGTERM, then SIGKILL after a short
                       grace period; Windows uses taskkill /T /F immediately.
                       0 never interrupts the command itself. Defaults to 0.

Environment:
  MST_THROTTLE_LIMIT   Number of slots shared by every throttle on this host
                       and namespace. Invalid values (non-integer, zero or
                       less) fall back to the default of 1.

Exit codes:
  0  the wrapped command succeeded
  1  the wrapped command failed, was killed, could not be started, ran past
     the timeout, or the wrapper could not get or release a slot
  2  throttle itself was called incorrectly`;

const optionName = (argument: string): string => {
  if (!argument.startsWith("--")) return argument.slice(0, 2);
  const valueStart = argument.indexOf("=", 3);
  return valueStart === -1 ? argument : argument.slice(0, valueStart);
};

const unexpectedArgument = (argument: string): Error =>
  argument.startsWith("-") && argument !== "-"
    ? new Error(`Unknown option '${optionName(argument)}'`)
    : new Error(
        `Unexpected argument '${argument}'. This command does not take positional arguments`,
      );

const TIMEOUT_FLAG = "--timeout";

const separatedTimeout = (
  rest: readonly string[],
): readonly [string, readonly string[]] | Error => {
  const [timeoutText, ...after] = rest;
  if (timeoutText === undefined) {
    return new Error(`Option '${TIMEOUT_FLAG} <value>' argument missing`);
  }
  if (timeoutText.length > 1 && timeoutText.startsWith("-")) {
    return new Error(
      `Option '${TIMEOUT_FLAG}' argument is ambiguous.\nDid you forget to specify the option argument for '${TIMEOUT_FLAG}'?\nTo specify an option argument starting with a dash use '${TIMEOUT_FLAG}=-XYZ'.`,
    );
  }
  return [timeoutText, after];
};

const timeoutArgument = (
  head: readonly string[],
  found: string | undefined,
): string | undefined | Error => {
  const [first, ...rest] = head;
  if (first === undefined) return found;
  if (first.startsWith(`${TIMEOUT_FLAG}=`)) {
    return timeoutArgument(rest, first.slice(TIMEOUT_FLAG.length + 1));
  }
  if (first !== TIMEOUT_FLAG) return unexpectedArgument(first);
  const separated = separatedTimeout(rest);
  return separated instanceof Error ? separated : timeoutArgument(separated[1], separated[0]);
};

const parsedTimeoutSeconds = (head: readonly string[]): { seconds: number } | string => {
  const raw = timeoutArgument(head, undefined);
  if (raw instanceof Error) return `throttle: ${raw.message}\n\n${USAGE}`;
  if (raw !== undefined && !/^[0-9]+$/.test(raw)) {
    return `throttle: --timeout expects a whole number of seconds, got "${raw}"\n\n${USAGE}`;
  }
  return { seconds: raw === undefined ? 0 : Number(raw) };
};

export const parseInvocation = (argv: readonly string[]): Invocation | string => {
  const split = argv.indexOf("--");
  if (split === -1) return USAGE;
  const timeout = parsedTimeoutSeconds(argv.slice(0, split));
  if (typeof timeout === "string") return timeout;
  const [executable, ...handedArgs] = argv.slice(split + 1);
  if (executable === undefined) return USAGE;
  return {
    timeoutSec: timeout.seconds,
    executable,
    args: handedArgs,
    commandLine: [executable, ...handedArgs].join(" "),
  };
};
