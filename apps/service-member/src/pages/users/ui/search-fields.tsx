import { Button, Field } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { maximumKeywordLength } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

function SearchFields({ keyword }: Readonly<{ keyword: string }>): ReactElement {
  const [draft, setDraft] = useState(keyword);
  const navigate = useNavigate();
  function search(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    const next = draft.trim();
    void navigate({ search: next === "" ? {} : { keyword: next }, to: "/search" });
  }
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
}

export { SearchFields };
