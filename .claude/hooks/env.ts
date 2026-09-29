import { existsSync } from "node:fs";
import { join } from "node:path";

export const projectDir = process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd();

const localEnv = join(projectDir, ".env.local");
if (existsSync(localEnv)) {
  process.loadEnvFile(localEnv);
}

export const typesafeApiKey = process.env["TYPESAFE_API_KEY"] ?? "";

export const readHookInput = async <T>(): Promise<T> => {
  const chunks: Array<Buffer> = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

export const block = (message: string): never => {
  process.stderr.write(`${message}\n`);
  process.exit(2);
};

export const requireTypesafeKey = () => {
  if (typesafeApiKey === "") {
    block(
      "TYPESAFE_API_KEY が未設定のため jev の検査を実行できない。環境変数か .env.local で設定すること。",
    );
  }
};
