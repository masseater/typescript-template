import { httpStatus, type Application } from "@repo/config";
import { Effect, Result, Schema } from "effect";

import { filesystem, isNotFound, paths } from "./host.ts";
import { privatePath } from "./private-path.ts";

import type { Connect } from "vite-plus";

type BoundaryRoots = Readonly<{
  application: Application;
  applicationRoot: string;
  canonicalRepositoryRoot: string;
  repositoryRoot: string;
}>;

const maxDecodeDepth = 3;

class UndecidablePath extends Schema.TaggedError<UndecidablePath>()("UndecidablePath", {
  encodedPathname: Schema.String,
}) {}

const decodedPathname = (
  encodedPathname: string,
  remainingDepth: number,
): Effect.Effect<string, UndecidablePath> => {
  if (remainingDepth === 0) {
    return Effect.succeed(encodedPathname);
  }
  const decodedOnce = Result.try(() => decodeURIComponent(encodedPathname));
  if (Result.isFailure(decodedOnce)) {
    return Effect.fail(new UndecidablePath({ encodedPathname }));
  }
  return decodedOnce.success === encodedPathname
    ? Effect.succeed(encodedPathname)
    : decodedPathname(decodedOnce.success, remainingDepth - 1);
};

const resolvePath = (
  file: string,
): Promise<
  | Readonly<{ kind: "resolved"; path: string }>
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "unresolvable"; cause: unknown }>
> =>
  Effect.runPromise(
    filesystem.realPath(file).pipe(
      Effect.match({
        onFailure: (cause) =>
          isNotFound(cause)
            ? { kind: "missing" as const }
            : { kind: "unresolvable" as const, cause },
        onSuccess: (resolved) => ({ kind: "resolved" as const, path: resolved }),
      }),
    ),
  );

const deniesRequest = (
  requestUrl: string | undefined,
  roots: BoundaryRoots,
): Effect.Effect<boolean, UndecidablePath> =>
  Effect.gen(function* deniesRequestProgram() {
    const [urlPath = "/"] = (requestUrl ?? "/").split("?");
    const pathname = yield* decodedPathname(urlPath, maxDecodeDepth);
    const servedFile = pathname.startsWith("/@fs/")
      ? pathname.slice("/@fs".length)
      : paths.resolve(roots.applicationRoot, `.${pathname}`);
    const resolved = yield* Effect.promise(() => resolvePath(servedFile));
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
  });

const boundaryVerdict = (
  requestUrl: string | undefined,
  rootsOf: () => Promise<BoundaryRoots>,
): Promise<Readonly<{ denied: boolean }> | Readonly<{ undecidable: UndecidablePath }>> =>
  Effect.runPromise(
    Effect.gen(function* boundaryVerdictProgram() {
      const roots = yield* Effect.promise(() => rootsOf());
      return { denied: yield* deniesRequest(requestUrl, roots) };
    }).pipe(
      Effect.match({
        onFailure: (undecidableRequest) => ({ undecidable: undecidableRequest }),
        onSuccess: (verdict) => verdict,
      }),
    ),
  );

type RequestGuard = (
  ...guardArguments: readonly [
    Readonly<Pick<Parameters<Connect.NextHandleFunction>[0], "url">>,
    Readonly<Pick<Parameters<Connect.NextHandleFunction>[1], "end" | "writeHead">>,
    () => void,
  ]
) => Promise<void>;

const createRequestGuard =
  (rootsOf: () => Promise<BoundaryRoots>): RequestGuard =>
  (...guardArguments) =>
    Effect.runPromise(
      Effect.gen(function* guardRequest() {
        const [incomingRequest, serverResponse, proceed] = guardArguments;
        const verdict = yield* Effect.promise(() => boundaryVerdict(incomingRequest.url, rootsOf));
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
      }),
    );

export { createRequestGuard, resolvePath };
export type { RequestGuard };
