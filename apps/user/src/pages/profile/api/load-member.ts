import { notFound } from "@tanstack/react-router";

import type { Member } from "#pages/profile/model/member.ts";
import { userClient } from "#shared/api/index.ts";
import { absent, apiDataOrNone } from "@repo/runtime/client";
import { MemberView } from "@repo/runtime/contracts";

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

export { loadMember };
