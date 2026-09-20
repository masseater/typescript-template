import { absent, apiDataOrNone } from "@repo/runtime/client";
import { notFound } from "@tanstack/react-router";

import { userClient } from "#shared/api/index.ts";
import { MemberView } from "#shared/contracts/index.ts";

import type { Member } from "#pages/profile/model/member.ts";

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
