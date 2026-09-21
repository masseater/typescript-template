import { realpath } from "node:fs/promises";
import path from "node:path";

import { httpStatus, type Application } from "@repo/config";

import { privatePath } from "./private-path.ts";

import type { Connect } from "vite-plus";

type BoundaryRoots = Readonly<{
  application: Application;
  applicationRoot: string;
  canonicalRepositoryRoot: string;
  repositoryRoot: string;
}>;

const maxDecodeDepth = 3;

const decodedPathname = (encodedPathname: string, remainingDepth: number): string => {
  if (remainingDepth === 0) {
    return encodedPathname;
  }
  const decodedOnce = decodeURIComponent(encodedPathname);
  return decodedOnce === encodedPathname
    ? encodedPathname
    : decodedPathname(decodedOnce, remainingDepth - 1);
};

const isMissingPath = (cause: unknown): boolean =>
  typeof cause === "object" && cause !== null && "code" in cause && cause["code"] === "ENOENT";

const resolvePath = async (
  file: string,
): Promise<
  | Readonly<{ kind: "resolved"; path: string }>
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "unresolvable"; cause: unknown }>
> => {
  try {
    return { kind: "resolved", path: await realpath(file) };
  } catch (cause: unknown) {
    return isMissingPath(cause) ? { kind: "missing" } : { kind: "unresolvable", cause };
  }
};

const deniesRequest = async (
  requestUrl: string | undefined,
  roots: BoundaryRoots,
): Promise<boolean> => {
  const [urlPath = "/"] = (requestUrl ?? "/").split("?");
  const pathname = decodedPathname(urlPath, maxDecodeDepth);
  const servedFile = pathname.startsWith("/@fs/")
    ? pathname.slice("/@fs".length)
    : path.resolve(roots.applicationRoot, `.${pathname}`);
  const resolved = await resolvePath(servedFile);
  if (resolved.kind === "unresolvable") {
    return true;
  }
  const canonicalServedFile = resolved.kind === "resolved" ? resolved.path : servedFile;
  const { application, repositoryRoot } = roots;
  return (
    privatePath({ application, candidatePath: pathname, repositoryRoot }) ||
    privatePath({ application, candidatePath: servedFile, repositoryRoot }) ||
    privatePath({
      application,
      candidatePath: canonicalServedFile,
      repositoryRoot: roots.canonicalRepositoryRoot,
    })
  );
};

const boundaryVerdict = async (
  requestUrl: string | undefined,
  rootsOf: () => Promise<BoundaryRoots>,
): Promise<Readonly<{ denied: boolean }> | Readonly<{ undecidable: unknown }>> => {
  try {
    return { denied: await deniesRequest(requestUrl, await rootsOf()) };
  } catch (undecidableRequest) {
    return { undecidable: undecidableRequest };
  }
};

type RequestGuard = (
  ...guardArguments: readonly [
    Readonly<Pick<Parameters<Connect.NextHandleFunction>[0], "url">>,
    Readonly<Pick<Parameters<Connect.NextHandleFunction>[1], "end" | "writeHead">>,
    () => void,
  ]
) => Promise<void>;

const createRequestGuard =
  (rootsOf: () => Promise<BoundaryRoots>): RequestGuard =>
  async (...guardArguments) => {
    const [incomingRequest, serverResponse, proceed] = guardArguments;
    const verdict = await boundaryVerdict(incomingRequest.url, rootsOf);
    if ("denied" in verdict && !verdict.denied) {
      proceed();
      return;
    }
    const undecidable = "undecidable" in verdict;
    serverResponse.writeHead(
      undecidable ? httpStatus.badRequest : httpStatus.forbidden,
      undecidable ? {} : { "cache-control": "no-store" },
    );
    serverResponse.end(undecidable ? "Invalid request" : "Private development resource denied");
  };

export { createRequestGuard, resolvePath };
export type { RequestGuard };
