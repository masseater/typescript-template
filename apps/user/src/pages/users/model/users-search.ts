import { Option, Schema } from "effect";
import { UserKeyword } from "@template/runtime/contracts";

interface UsersSearch {
  readonly keyword?: string;
  readonly page?: number;
}

const secondPage = 2;
const LaterPage = Schema.Int.check(Schema.isGreaterThanOrEqualTo(secondPage));
const Scalar = Schema.Union([Schema.String, Schema.Number, Schema.Boolean]);

function normalizeUsersSearch(raw: Readonly<Record<string, unknown>>): UsersSearch {
  const keyword = Schema.decodeUnknownOption(Scalar)(raw["keyword"]).pipe(
    Option.flatMap((value) => Schema.decodeUnknownOption(UserKeyword)(String(value))),
  );
  const page = Schema.decodeUnknownOption(LaterPage)(raw["page"]);
  return {
    ...(Option.isSome(keyword) ? { keyword: keyword.value } : {}),
    ...(Option.isSome(page) ? { page: page.value } : {}),
  };
}

export { normalizeUsersSearch };
export type { UsersSearch };
