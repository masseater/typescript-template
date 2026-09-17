// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, open, readFile, stat } from "node:fs/promises";

const privateFileMode = 0o600;
const privateDirectoryMode = 0o700;
const groupAndOtherPermissions = 0o077;

type FileLocation = Readonly<Pick<URL, "href">>;

function isErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

async function writeWithFlag(path: FileLocation, content: string, flag: "w" | "wx"): Promise<void> {
  const file = await open(new URL(path.href), flag, privateFileMode);
  try {
    await file.writeFile(content);
  } finally {
    await file.close();
  }
}

async function assertOwnerOnly(path: FileLocation): Promise<void> {
  const { mode } = await stat(new URL(path.href));
  // oxlint-disable-next-line no-bitwise
  if ((mode & groupAndOtherPermissions) !== 0) {
    throw new Error("Local credential file permissions must be 0600");
  }
}

async function replacePrivateFile(path: FileLocation, content: string): Promise<void> {
  await writeWithFlag(path, content, "w");
  await chmod(new URL(path.href), privateFileMode);
}

async function writePrivateFile(path: FileLocation, content: string): Promise<void> {
  try {
    await writeWithFlag(path, content, "wx");
  } catch (error) {
    if (!isErrorCode(error, "EEXIST")) {
      throw error;
    }
    if ((await readFile(new URL(path.href), "utf-8")) !== content) {
      throw new Error("Existing local configuration differs; it was preserved", { cause: error });
    }
  }
  await assertOwnerOnly(path);
}

export {
  assertOwnerOnly,
  isErrorCode,
  privateDirectoryMode,
  privateFileMode,
  replacePrivateFile,
  writePrivateFile,
};
