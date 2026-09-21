import type { ReactElement } from "react";

type SketchKind = "profile" | "search" | "security";

function FeatureSketch({ kind }: Readonly<{ kind: SketchKind }>): ReactElement {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-36 flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      {kind === "profile" ? (
        <>
          <div className="flex items-center gap-3">
            <div className="size-14 shrink-0 rounded-full bg-secondary" />
            <div className="flex w-full flex-col gap-2">
              <div className="h-2.5 w-2/3 rounded-sm bg-secondary" />
              <div className="h-2.5 w-1/3 rounded-sm bg-muted" />
            </div>
          </div>
          <div className="h-2.5 w-full rounded-sm bg-muted" />
          <div className="h-2.5 w-4/5 rounded-sm bg-muted" />
        </>
      ) : null}
      {kind === "search" ? (
        <>
          <div className="h-3 w-full rounded-sm bg-secondary" />
          <div className="flex items-center gap-3">
            <div className="size-10 shrink-0 rounded-full bg-secondary" />
            <div className="flex w-full flex-col gap-2">
              <div className="h-2.5 w-1/2 rounded-sm bg-secondary" />
              <div className="h-2.5 w-3/4 rounded-sm bg-muted" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="size-10 shrink-0 rounded-full bg-secondary" />
            <div className="flex w-full flex-col gap-2">
              <div className="h-2.5 w-2/5 rounded-sm bg-secondary" />
              <div className="h-2.5 w-3/5 rounded-sm bg-muted" />
            </div>
          </div>
        </>
      ) : null}
      {kind === "security" ? (
        <>
          <div className="h-2.5 w-1/2 rounded-sm bg-secondary" />
          <div className="h-2.5 w-1/3 rounded-sm bg-muted" />
          <div className="mt-2 h-8 w-28 rounded-md bg-secondary" />
        </>
      ) : null}
    </div>
  );
}

export { FeatureSketch };
export type { SketchKind };
