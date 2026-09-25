import { maximumKeywordLength } from "@repo/config/paging";
import { Button, Field } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";

import { useSearchDraft } from "../model/search-draft.ts";

import type { ReactElement } from "react";

function SearchFields({ keyword }: Readonly<{ keyword: string }>): ReactElement {
  const [draft, setDraft] = useSearchDraft(keyword);
  const navigate = useNavigate();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    const trimmed = draft.trim();
    void navigate({
      replace: true,
      search: trimmed === "" ? {} : { keyword: trimmed },
      to: "/search",
    });
  }
  return (
    <search>
      <form noValidate onSubmit={handleSubmit} className="flex w-full max-w-search items-end gap-2">
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
