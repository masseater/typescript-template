import type { ChangeEventHandler, SubmitEventHandler } from "react";
import { useCallback, useState } from "react";
import type { UsersSearch } from "#users-search.ts";
import { normalizeUsersSearch } from "#users-search.ts";
import { useNavigate } from "@tanstack/react-router";

interface UserFilterForm {
  readonly handleClear: () => void;
  readonly handleKeywordChange: ChangeEventHandler<HTMLInputElement>;
  readonly handleRoleChange: (role: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly handleVerifiedChange: (verified: string) => void;
  readonly keyword: string;
  readonly role: string;
  readonly verified: string;
}

function useUserFilterForm(search: UsersSearch): UserFilterForm {
  const navigate = useNavigate({ from: "/" });
  const [keyword, setKeyword] = useState(search.keyword ?? "");
  const [role, setRole] = useState<string>(search.role ?? "");
  const [verified, setVerified] = useState<string>(
    search.verified === undefined ? "" : String(search.verified),
  );
  const handleKeywordChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
    (event: Readonly<{ target: Readonly<Pick<HTMLInputElement, "value">> }>) => {
      setKeyword(event.target.value);
    },
    [],
  );
  const handleSubmit = useCallback<SubmitEventHandler<HTMLFormElement>>(
    (event: Readonly<{ preventDefault: () => void }>) => {
      event.preventDefault();
      void navigate({ search: normalizeUsersSearch({ keyword, role, verified }) });
    },
    [keyword, navigate, role, verified],
  );
  const handleClear = useCallback(() => {
    void navigate({ search: {} });
  }, [navigate]);
  return {
    handleClear,
    handleKeywordChange,
    handleRoleChange: setRole,
    handleSubmit,
    handleVerifiedChange: setVerified,
    keyword,
    role,
    verified,
  };
}

export { useUserFilterForm };
