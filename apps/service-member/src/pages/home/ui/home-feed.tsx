import { Avatar, ButtonLink, Page, STATUS_VARIANT, StatusMessage, TextLink } from "@repo/ui";

import { m } from "#shared/i18n/index.ts";

import type { ReactElement } from "react";

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

function PersonLink({ entry }: Readonly<{ entry: HomeEntry }>): ReactElement {
  return (
    <TextLink to="/users/$id" params={{ id: entry.actorId }}>
      {entry.actorName}
    </TextLink>
  );
}

function HomeFeed({ state }: Readonly<{ state: HomeFeedState }>): ReactElement {
  const lead = state.status === "ready" ? state.entries[0] : undefined;
  const rest = state.status === "ready" ? state.entries.slice(1) : [];
  return (
    <Page title={m.nav_home()}>
      {state.status === "failure" && <p className="text-sm text-destructive">{state.message}</p>}
      {state.status === "pending" && (
        <StatusMessage variant={STATUS_VARIANT.pending}>{m.home_loading()}</StatusMessage>
      )}
      {state.status === "empty" && (
        <>
          <StatusMessage variant={STATUS_VARIANT.empty}>{m.home_empty()}</StatusMessage>
          <ButtonLink to="/users" variant="primary">
            {m.home_empty_action()}
          </ButtonLink>
        </>
      )}
      {lead !== undefined && (
        <div className="flex flex-col gap-6">
          <article data-slot="home-lead" className="flex flex-col items-start gap-2">
            <Avatar name={lead.actorName} size="large" />
            <p className="text-xl leading-tight font-bold">
              <PersonLink entry={lead} />
            </p>
            <p className="text-base leading-relaxed text-foreground">{lead.change}</p>
            <p className="text-sm leading-normal text-muted-foreground">{lead.updatedAtLabel}</p>
          </article>
          {rest.length > 0 && (
            <ul className="flex flex-col gap-3">
              {rest.map((entry) => (
                <li
                  key={entry.key}
                  className="flex flex-col items-start gap-1 border-t border-border pt-3"
                >
                  <div className="flex items-center gap-2">
                    <Avatar name={entry.actorName} size="small" />
                    <PersonLink entry={entry} />
                  </div>
                  <p className="text-base leading-relaxed text-foreground">{entry.change}</p>
                  <p className="text-sm leading-normal text-muted-foreground">
                    {entry.updatedAtLabel}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Page>
  );
}

export { HomeFeed };
export type { HomeEntry, HomeFeedState };
