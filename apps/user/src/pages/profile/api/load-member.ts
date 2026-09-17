import type { Member } from "#pages/profile/model/member.ts";
import { MemberView } from "@template/runtime/contracts";
import { readApi } from "#shared/api/index.ts";

const notFound = 404;

async function loadMember(id: string): Promise<Member | undefined> {
  return readApi(`/api/member?${new URLSearchParams({ id }).toString()}`, MemberView, notFound);
}

export { loadMember };
