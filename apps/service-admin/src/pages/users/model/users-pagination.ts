import { adminPageSize } from "@repo/config/paging";

const usersPageSize = adminPageSize;
const maximumUsersPage = Math.floor(Number.MAX_SAFE_INTEGER / usersPageSize);

export { maximumUsersPage, usersPageSize };
