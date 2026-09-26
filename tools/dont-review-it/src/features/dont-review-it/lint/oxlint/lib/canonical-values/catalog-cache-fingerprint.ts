import { bytesAt, startSha256, type Sha256Digest } from "../../../../platform/synchronous-host.ts";
import { CACHE_FORMAT_VERSION } from "./catalog-cache-validation.ts";

import type { ScannedFile } from "./source-files.ts";

const updateLengthPrefixed = (hash: Sha256Digest, identity: string): void => {
  hash.update(`${Buffer.byteLength(identity)}:`);
  hash.update(identity);
};

const updateFileFingerprint = (hash: Sha256Digest, file: ScannedFile): void => {
  const fileBytes = bytesAt(file.absolutePath);
  [file.relativePath, file.realPathIdentity, file.symbolicLinkTarget ?? ""].forEach((identity) => {
    updateLengthPrefixed(hash, identity);
  });
  hash.update(`${fileBytes.byteLength}:`);
  hash.update(fileBytes);
};

const updateProblemFingerprint = (
  hash: Sha256Digest,
  problem: { readonly filePath: string; readonly kind: string; readonly line: number },
): void => {
  updateLengthPrefixed(hash, JSON.stringify(problem));
};

export const cacheInputFingerprint = (
  files: readonly ScannedFile[],
  problems: readonly {
    readonly filePath: string;
    readonly kind: string;
    readonly line: number;
  }[] = [],
): string => {
  const hash = startSha256();
  hash.update(String(CACHE_FORMAT_VERSION));
  files.forEach((file) => {
    updateFileFingerprint(hash, file);
  });
  problems.forEach((problem) => {
    updateProblemFingerprint(hash, problem);
  });
  return hash.digest("hex");
};
