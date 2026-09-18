import { useNavigate } from "@tanstack/react-router";
import { maximumKeywordLength } from "@template/runtime/contracts";
import { Button, Field } from "@template/ui";
import { useState, type ReactElement } from "react";

const SearchFields = ({ keyword }: Readonly<{ keyword: string }>): ReactElement => {
  const [draft, setDraft] = useState(keyword);
  const navigate = useNavigate();
  const search = (event: Readonly<{ preventDefault: () => void }>): void => {
    event.preventDefault();
    const next = draft.trim();
    void navigate({ search: next === "" ? {} : { keyword: next }, to: "/users" });
  };
  return (
    <search>
      <form onSubmit={search} className="flex w-full max-w-search items-end gap-2">
        <Field
          label="名前で検索"
          name="keyword"
          maxLength={maximumKeywordLength}
          value={draft}
          onValueChange={setDraft}
        />
        <Button type="submit" variant="primary">
          検索
        </Button>
      </form>
    </search>
  );
};

export { SearchFields };
