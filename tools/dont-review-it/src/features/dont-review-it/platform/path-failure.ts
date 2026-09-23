import { attempt } from "es-toolkit";

import type { PlatformError } from "effect";

const MISSING_PATH_CODE = "ENOENT";

const MISSING_PARENT_CODE = "ENOTDIR";

const NOT_A_LINK_CODE = "EINVAL";

export const failureCodeOf = (failure: unknown): string | null => {
  if (typeof failure !== "object" || failure === null) return null;
  if (!("code" in failure)) return null;
  return typeof failure.code === "string" ? failure.code : null;
};

const isMissingCode = (code: string | null): boolean =>
  code === MISSING_PATH_CODE || code === MISSING_PARENT_CODE;

export const readUnlessMissing = <Read>(read: () => Read): Read | null => {
  const [unreadablePath, found] = attempt<Read, Error>(read);
  if (unreadablePath === null) return found;

  if (isMissingCode(failureCodeOf(unreadablePath))) return null;
  throw unreadablePath;
};

export const isMissingPath = (failure: PlatformError.PlatformError): boolean =>
  failure.reason._tag === "NotFound" || isMissingCode(failureCodeOf(failure.reason.cause));

export const isNotALink = (failure: PlatformError.PlatformError): boolean =>
  failureCodeOf(failure.reason.cause) === NOT_A_LINK_CODE;
