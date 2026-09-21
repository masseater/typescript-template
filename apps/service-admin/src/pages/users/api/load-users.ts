import { errorMessage } from "@repo/auth-ui";
import { apiData } from "@repo/runtime/client";
import { formatWarekiDate } from "@repo/ui";

import { adminClient } from "#shared/api/index.ts";
import { UserList } from "#shared/contracts/index.ts";

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
  try {
    const { total, users } = apiData(UserList, await adminClient().users.get({ query }));
    const listed = users.map(
      ({ createdAt, email, emailVerified, id, name, role, twoFactorEnabled }) => ({
        email,
        emailVerified,
        id,
        name,
        registeredOn: formatWarekiDate(createdAt),
        role,
        twoFactorEnabled,
      }),
    );
    return { total, users: listed };
  } catch (failure) {
    throw new Error(errorMessage(failure));
  }
}

export { listUsers };
export type { ListedUser, ListedUsers };
