import { PlatformError } from "effect";

type PlatformFailure = { readonly reason: unknown };

const isSystemError = (
  platformFailure: PlatformFailure,
  tag: PlatformError.SystemErrorTag,
): boolean =>
  platformFailure.reason instanceof PlatformError.SystemError &&
  platformFailure.reason._tag === tag;

const isNotFound = (platformFailure: PlatformFailure): boolean =>
  isSystemError(platformFailure, "NotFound");

const GROUP_AND_OTHER_PERMISSIONS = 0o077;

const modeAllowsGroupOrOther = (fileMode: number): boolean =>
  (fileMode & GROUP_AND_OTHER_PERMISSIONS) !== 0;

export { isNotFound, isSystemError, modeAllowsGroupOrOther };
export type { PlatformFailure };
