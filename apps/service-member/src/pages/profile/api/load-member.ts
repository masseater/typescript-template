import { ROLE } from "@repo/config";
import { absent, apiDataOrNone } from "@repo/runtime/client";
import { queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";

import { userClient } from "#shared/api/index.ts";
import { MemberView } from "#shared/contracts/index.ts";

import type { Member } from "#pages/profile/model/member.ts";

const memberKey = (id: string): readonly [string, string] => [ROLE.member, id];

async function loadMember(id: string): Promise<Member> {
  const { api } = await userClient();
  const member = apiDataOrNone(
    MemberView,
    await api.member.get({ query: { id } }),
    absent.notFound,
  );
  if (member === undefined) {
    throw notFound();
  }
  return member;
}

function memberOptions(id: string) {
  return queryOptions({
    queryFn: async () => loadMember(id),
    queryKey: memberKey(id),
    retry: false,
  });
}

export { memberKey, memberOptions };
