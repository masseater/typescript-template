import { Option, Schema } from "effect";
import { UserKeyword } from "@template/runtime/contracts";

interface UsersSearch {
  readonly keyword?: string;
}

const Scalar = Schema.Union([Schema.String, Schema.Number, Schema.Boolean]);

function normalizeUsersSearch(raw: Readonly<Record<string, unknown>>): UsersSearch {
  const keyword = Schema.decodeUnknownOption(Scalar)(raw["keyword"]).pipe(
    Option.flatMap((value) => Schema.decodeUnknownOption(UserKeyword)(String(value))),
  );
  return Option.isSome(keyword) ? { keyword: keyword.value } : {};
}

export { normalizeUsersSearch };
export type { UsersSearch };
