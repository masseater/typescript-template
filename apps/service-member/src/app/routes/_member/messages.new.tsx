import { createFileRoute, redirect } from "@tanstack/react-router";
import { Option, Schema } from "effect";

import { ComposePage, lookupConversation } from "#pages/messages/index.ts";
import { loadMember } from "#pages/profile/index.ts";

import type { ReactElement } from "react";

const ComposeSearchParams = Schema.Struct({
  peer: Schema.String.check(Schema.isLengthBetween(1, 256)),
});

type ComposeSearch = typeof ComposeSearchParams.Type;

const decodeComposeSearch = Schema.decodeUnknownOption(ComposeSearchParams);

function requireComposeSearch(raw: unknown): ComposeSearch {
  return Option.getOrThrowWith(decodeComposeSearch(raw), () => {
    throw redirect({ replace: true, search: {}, to: "/messages" });
  });
}

const Route = createFileRoute("/_member/messages/new")({
  component: ComposeRoute,
  validateSearch: requireComposeSearch,
  loaderDeps: ({ search }: Readonly<{ search: ComposeSearch }>) => search,
  loader: async ({ deps }: Readonly<{ deps: ComposeSearch }>) => {
    const existing = await lookupConversation(deps.peer);
    if (existing !== null) {
      throw redirect({ params: { id: existing }, replace: true, search: {}, to: "/messages/$id" });
    }
    return loadMember(deps.peer);
  },
});

function ComposeRoute(): ReactElement {
  const member = Route.useLoaderData();
  return <ComposePage peerId={member.id} peerName={member.name} />;
}

export { Route };
