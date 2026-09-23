export const EXIT_SUCCESS = 0;

export const EXIT_PROBLEMS_FOUND = 1;

export const EXIT_MISUSE = 2;

export type CliResult = {
  readonly exitCode: number;
  readonly out: string;
  readonly error: string;
};

export const misuseOf = (failure: unknown): CliResult => ({
  exitCode: EXIT_MISUSE,
  out: "",
  error: `${failure instanceof Error ? failure.message : String(failure)}\n`,
});
