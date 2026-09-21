import { absent, apiDataOrNoneFor } from "@repo/runtime/client";
import { notFound } from "@tanstack/react-router";

import { userClient } from "#shared/api/index.ts";
import { MemberView } from "#shared/contracts/index.ts";

type Member = typeof MemberView.Type;

async function loadMember(id: string): Promise<Member> {
  const { api } = await userClient();
  const member = apiDataOrNoneFor(absent.notFound)(
    MemberView,
    await api.member.get({ query: { id } }),
  );
  if (member === undefined) {
    throw notFound();
  }
  return member;
}

export { loadMember };
