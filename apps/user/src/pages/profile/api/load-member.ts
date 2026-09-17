import { absence, readApi } from "#shared/api/index.ts";
import type { Member } from "#pages/profile/model/member.ts";
import { MemberView } from "@template/runtime/contracts";
import { notFound } from "@tanstack/react-router";

async function loadMember(id: string): Promise<Member> {
  const member = await readApi(
    `/api/member?${new URLSearchParams({ id }).toString()}`,
    MemberView,
    absence.notFound,
  );
  if (member === undefined) {
    throw notFound();
  }
  return member;
}

export { loadMember };
