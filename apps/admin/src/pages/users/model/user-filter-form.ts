import { useNavigate } from "@tanstack/react-router";
import { useState, type SubmitEventHandler } from "react";

import { normalizeUsersSearch, type UsersSearch } from "./users-search.ts";

type UserFilterForm = {
  readonly handleClear: () => void;
  readonly handleKeywordChange: (value: string) => void;
  readonly handleRoleChange: (role: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly handleVerifiedChange: (verified: string) => void;
  readonly keyword: string;
  readonly role: string;
  readonly verified: string;
};

const useUserFilterForm = (search: UsersSearch): UserFilterForm => {
  const navigate = useNavigate({ from: "/" });
  const [keyword, setKeyword] = useState(search.keyword ?? "");
  const [role, setRole] = useState<string>(search.role ?? "");
  const [verified, setVerified] = useState<string>(
    search.verified === undefined ? "" : String(search.verified),
  );
  const handleSubmit = (event: Readonly<{ preventDefault: () => void }>): void => {
    event.preventDefault();
    void navigate({ search: normalizeUsersSearch({ keyword, role, verified }) });
  };
  const handleClear = (): void => {
    void navigate({ search: {} });
  };
  return {
    handleClear,
    handleKeywordChange: setKeyword,
    handleRoleChange: setRole,
    handleSubmit,
    handleVerifiedChange: setVerified,
    keyword,
    role,
    verified,
  };
};

export { useUserFilterForm };
