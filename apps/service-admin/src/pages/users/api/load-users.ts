import { errorMessage } from "@repo/auth-ui";
import { apiData } from "@repo/runtime/client";
import { formatWarekiDate } from "@repo/ui";

import { adminClient } from "#shared/api/index.ts";
import { UserList } from "#shared/contracts/index.ts";

interface ListedUser {
  readonly accountState: (typeof UserList.Type)["users"][number]["accountState"];
  readonly email: string;
  readonly emailVerified: boolean;
  readonly id: string;
  readonly name: string;
  readonly registeredOn: string;
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
      ({ accountState, createdAt, email, emailVerified, id, name, twoFactorEnabled }) => ({
        accountState,
        email,
        emailVerified,
        id,
        name,
        registeredOn: formatWarekiDate(createdAt),
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
