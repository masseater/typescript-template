import { useAtom } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Atom } from "effect/unstable/reactivity";

import { normalizeUsersSearch } from "./users-search.ts";

import type { SubmitEventHandler } from "react";
import type { UsersSearch } from "./users-search.ts";

interface FilterValues {
  readonly keyword: string;
  readonly role: string;
  readonly verified: string;
}

interface UserFilterForm extends FilterValues {
  readonly handleClear: () => void;
  readonly handleKeywordChange: (value: string) => void;
  readonly handleRoleChange: (role: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly handleVerifiedChange: (verified: string) => void;
}

const filterAtom = Atom.family((search: UsersSearch) =>
  Atom.make<FilterValues>({
    keyword: search.keyword ?? "",
    role: search.role ?? "",
    verified: search.verified === undefined ? "" : String(search.verified),
  }),
);

function usersSearchFromFilters(keyword: string, role: string, verified: string): UsersSearch {
  return normalizeUsersSearch({
    ...(keyword.trim() === "" ? {} : { keyword }),
    ...(role === "" ? {} : { role }),
    ...(verified === "" ? {} : { verified }),
  });
}

function useUserFilterForm(search: UsersSearch): UserFilterForm {
  const navigate = useNavigate({ from: "/members" });
  const [values, setValues] = useAtom(filterAtom(search));
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    void navigate({ search: usersSearchFromFilters(values.keyword, values.role, values.verified) });
  }
  function handleClear(): void {
    void navigate({ search: {} });
  }
  function handleKeywordChange(keyword: string): void {
    setValues((current) => ({ ...current, keyword }));
  }
  function handleRoleChange(role: string): void {
    setValues((current) => ({ ...current, role }));
  }
  function handleVerifiedChange(verified: string): void {
    setValues((current) => ({ ...current, verified }));
  }
  return {
    ...values,
    handleClear,
    handleKeywordChange,
    handleRoleChange,
    handleSubmit,
    handleVerifiedChange,
  };
}

export { useUserFilterForm };
