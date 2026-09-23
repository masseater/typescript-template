import { Option } from "effect";

const searchValidator =
  <Search>(
    decode: (raw: unknown) => Option.Option<Search>,
    invalid: () => Error,
  ): ((raw: unknown) => Search) =>
  (raw) =>
    Option.getOrThrowWith(decode(raw), invalid);

export { searchValidator };
