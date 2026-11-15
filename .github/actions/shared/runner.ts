import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const MAX_OUTPUT_BYTES = 268_435_456;

export const env = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} is not set`);
  }
  return value;
};

export const optionalEnv = (name: string): string | undefined => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return undefined;
  }
  return value;
};

export interface RunOptions {
  readonly env?: Readonly<Record<string, string>>;
  readonly cwd?: string;
}

export const run = (
  command: string,
  args: readonly string[],
  { env: extraEnv = {}, cwd = "." }: RunOptions = {},
): string =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: MAX_OUTPUT_BYTES,
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();

export const ghJson = (args: readonly string[], token: string): unknown =>
  JSON.parse(run("gh", ["api", ...args], { env: { GH_TOKEN: token } }));

export const mask = (value: string): void => {
  console.log(`::add-mask::${value}`);
};

export const appendTo = (variable: string, entries: Readonly<Record<string, string>>): void => {
  const lines = Object.entries(entries).map(([key, value]) => `${key}=${value}\n`);
  appendFileSync(env(variable), lines.join(""));
};

export interface Request {
  readonly method?: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
}

export const EXIT_FAILURE = 1;

export const fetchOk = async (url: string, init: Request): Promise<Response> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${url} returned ${String(response.status)}`);
  }
  return response;
};

export const fetchJson = async (url: string, init: Request): Promise<unknown> => {
  const response = await fetchOk(url, init);
  return response.json();
};

const ATTEMPTS = 4;
const FIRST_ATTEMPT = 1;
const NEXT = 1;

export const fetchJsonWithRetry = async (
  url: string,
  init: Request,
  attempt = FIRST_ATTEMPT,
): Promise<unknown> => {
  try {
    return await fetchJson(url, init);
  } catch (error) {
    if (attempt >= ATTEMPTS) {
      throw error;
    }
    return fetchJsonWithRetry(url, init, attempt + NEXT);
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const field = (value: unknown, key: string): unknown => {
  if (!isRecord(value)) {
    throw new TypeError(`expected an object with ${key}`);
  }
  return value[key];
};

export const stringField = (value: unknown, key: string): string => {
  const found = field(value, key);
  if (typeof found !== "string") {
    throw new TypeError(`${key} is not a string`);
  }
  return found;
};

export const oidcToken = async (audience: string): Promise<string> => {
  const url = `${env("ACTIONS_ID_TOKEN_REQUEST_URL")}&audience=${audience}`;
  const body = await fetchJson(url, {
    headers: { authorization: `bearer ${env("ACTIONS_ID_TOKEN_REQUEST_TOKEN")}` },
  });
  const token = stringField(body, "value");
  mask(token);
  return token;
};
