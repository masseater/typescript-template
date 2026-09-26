import { m } from "#shared/i18n/index.ts";

type HomeEntry = {
  readonly actorId: string;
  readonly actorName: string;
  readonly change: string;
  readonly key: string;
  readonly updatedAtLabel: string;
};

type HomeFeedState =
  | { readonly status: "empty" }
  | { readonly message: string; readonly status: "failure" }
  | { readonly status: "pending" }
  | { readonly entries: readonly HomeEntry[]; readonly status: "ready" };

function presentFeed(
  items: readonly { actorId: string; actorName: string; profile: string; updatedAt: number }[],
  label: (updatedAt: number) => string,
): readonly HomeEntry[] {
  return items.map((item) => ({
    actorId: item.actorId,
    actorName: item.actorName,
    change: item.profile === "" ? m.home_profile_empty() : item.profile,
    key: `${item.actorId}-${item.updatedAt}`,
    updatedAtLabel: label(item.updatedAt),
  }));
}

function homeState(
  failure: string | undefined,
  entries: readonly HomeEntry[] | undefined,
  pending: boolean,
): HomeFeedState {
  if (failure !== undefined) {
    return { message: failure, status: "failure" };
  }
  if (pending || entries === undefined) {
    return { status: "pending" };
  }
  if (entries.length === 0) {
    return { status: "empty" };
  }
  return { entries, status: "ready" };
}

export { homeState, presentFeed };
export type { HomeEntry, HomeFeedState };
