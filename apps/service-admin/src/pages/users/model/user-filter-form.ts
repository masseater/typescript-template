import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { normalizeUsersSearch } from "./users-search.ts";

import type { SubmitEventHandler } from "react";
import type { UsersSearch } from "./users-search.ts";

interface UserFilterForm {
  readonly handleClear: () => void;
  readonly handleKeywordChange: (value: string) => void;
  readonly handleStatusChange: (status: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly handleVerifiedChange: (verified: string) => void;
  readonly keyword: string;
  readonly status: string;
  readonly verified: string;
}

function usersSearchFromFilters(keyword: string, status: string, verified: string): UsersSearch {
  return normalizeUsersSearch({
    ...(keyword.trim() === "" ? {} : { keyword }),
    ...(status === "" ? {} : { status }),
    ...(verified === "" ? {} : { verified }),
  });
}

function useUserFilterForm(search: UsersSearch): UserFilterForm {
  const navigate = useNavigate({ from: "/members" });
  const [keyword, setKeyword] = useState(search.keyword ?? "");
  const [status, setStatus] = useState<string>(search.status ?? "");
  const [verified, setVerified] = useState<string>(
    search.verified === undefined ? "" : String(search.verified),
  );
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    void navigate({ search: usersSearchFromFilters(keyword, status, verified) });
  }
  function handleClear(): void {
    void navigate({ search: {} });
  }
  return {
    handleClear,
    handleKeywordChange: setKeyword,
    handleStatusChange: setStatus,
    handleSubmit,
    handleVerifiedChange: setVerified,
    keyword,
    status,
    verified,
  };
}

export { useUserFilterForm };
