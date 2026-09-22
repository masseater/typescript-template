import { ROLE } from "@repo/config";
import { absent, apiDataOrNone } from "@repo/runtime/client";
import { queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";

import { userClient } from "#shared/api/index.ts";
import { MemberView } from "#shared/contracts/index.ts";

import type { Member } from "#pages/profile/model/member.ts";
import type { ApiReply } from "@repo/runtime/client";

const memberKey = (id: string): readonly [string, string] => [ROLE.member, id];

function loadMember(id: string): Promise<Member> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.member.get({ query: { id } }).then((response: ApiReply) => {
      const member = apiDataOrNone(MemberView, response, absent.notFound);
      if (member === undefined) {
        throw notFound();
      }
      return member;
    }),
  );
}

function memberOptions(id: string) {
  return queryOptions({
    queryFn: () => loadMember(id),
    queryKey: memberKey(id),
    retry: false,
  });
}

export { loadMember, memberOptions };
