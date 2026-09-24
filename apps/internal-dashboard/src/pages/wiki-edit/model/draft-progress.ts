import type { WikiSource } from "#shared/contracts/index.ts";

type DraftProgress = Readonly<{
  publishable: boolean;
  publishedUrl: string | null;
  version: number;
}>;

const draftProgress = (source: WikiSource): DraftProgress => {
  const version = source.draft?.version ?? 0;
  return {
    publishable: source.publishable && version > 0,
    publishedUrl: source.draft?.publishedUrl ?? null,
    version,
  };
};

export { draftProgress };
export type { DraftProgress };
