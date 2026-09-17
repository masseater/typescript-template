import { UserKeyword, maximumMemberPage } from "@template/runtime/contracts";
import { laterPage, searchNormalizer, searchText } from "@template/ui";

const normalizeUsersSearch = searchNormalizer({
  keyword: searchText(UserKeyword),
  page: laterPage(maximumMemberPage),
});

type UsersSearch = ReturnType<typeof normalizeUsersSearch>;

export { normalizeUsersSearch };
export type { UsersSearch };
