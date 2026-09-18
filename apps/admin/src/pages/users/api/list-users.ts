import { UserList } from "@template/runtime/contracts";
import { adminClient } from "#shared/api/index.ts";
import { apiData } from "@template/runtime/client";

const registeredDate = new Intl.DateTimeFormat("ja-JP", {
  day: "numeric",
  month: "numeric",
  timeZone: "Asia/Tokyo",
  year: "numeric",
});

interface ListedUser {
  readonly email: string;
  readonly emailVerified: boolean;
  readonly id: string;
  readonly name: string;
  readonly registeredOn: string;
  readonly role: (typeof UserList.Type)["users"][number]["role"];
  readonly twoFactorEnabled: boolean;
}

interface ListedUsers {
  readonly total: number;
  readonly users: readonly ListedUser[];
}

async function listUsers(query: Readonly<Record<string, string>>): Promise<ListedUsers> {
  const { total, users } = apiData(UserList, await adminClient().users.get({ query }));
  const listed = users.map(
    ({ createdAt, email, emailVerified, id, name, role, twoFactorEnabled }) => ({
      email,
      emailVerified,
      id,
      name,
      registeredOn: registeredDate.format(createdAt),
      role,
      twoFactorEnabled,
    }),
  );
  return { total, users: listed };
}

export { listUsers };
export type { ListedUser, ListedUsers };
