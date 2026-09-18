import { absent, apiDataOrNone } from "@template/runtime/client";
import type { Member } from "#entities/member/index.ts";
import { MemberView } from "@template/runtime/contracts";
import { notFound } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { userClient } from "#shared/api/index.ts";

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
  return queryOptions({ queryFn: async () => loadMember(id), queryKey: ["member", id] });
}

export { memberOptions };
