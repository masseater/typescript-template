import { absent, apiDataOrNoneFor } from "@repo/runtime/client";
import { notFound } from "@tanstack/react-router";

import { userClient } from "#shared/api/index.ts";
import { MemberView } from "#shared/contracts/index.ts";

import type { Member } from "#pages/profile/model/member.ts";

function loadMember(id: string): Promise<Member> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.member.get({ query: { id } }).then((response) => {
      const member = apiDataOrNoneFor(absent.notFound)(MemberView, response);
      if (member == null) {
        throw notFound();
      }
      return member;
    }),
  );
}

export { loadMember };
