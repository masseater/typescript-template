import { joinPath } from "../host.ts";

const withoutGitSuffix = (repositoryPath: string): string =>
  repositoryPath.replace(/\.git$/u, "").replace(/^\/+|\/+$/gu, "");

const urlAddressOf = (
  originUrl: string,
): Readonly<{ host: string; repositoryPath: string }> | undefined => {
  if (!URL.canParse(originUrl)) {
    return undefined;
  }
  const origin = new URL(originUrl);
  return { host: origin.hostname, repositoryPath: withoutGitSuffix(origin.pathname) };
};

const scpAddressOf = (
  originUrl: string,
): Readonly<{ host: string; repositoryPath: string }> | undefined => {
  const separator = originUrl.indexOf(":");
  const userSeparator = originUrl.indexOf("@");
  if (separator <= 0 || userSeparator > separator) {
    return undefined;
  }
  return {
    host: originUrl.slice(userSeparator + 1, separator),
    repositoryPath: withoutGitSuffix(originUrl.slice(separator + 1)),
  };
};

const isPlainSegment = (segment: string): boolean =>
  segment !== "" && segment !== "." && segment !== "..";

export const worktreeLocationOf = (
  placement: Readonly<{ home: string; name: string; originUrl: string }>,
): string | undefined => {
  const address = placement.originUrl.includes("://")
    ? urlAddressOf(placement.originUrl)
    : scpAddressOf(placement.originUrl);
  if (address === undefined) {
    return undefined;
  }
  const segments = [
    address.host,
    ...address.repositoryPath.split("/"),
    ...placement.name.split("/"),
  ];
  return segments.every(isPlainSegment)
    ? joinPath(placement.home, "worktrees", ...segments)
    : undefined;
};
