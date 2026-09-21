import { Button, Field } from "@repo/ui";
import { useDebouncedCallback } from "@tanstack/react-pacer/debouncer";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { useSearchDraft } from "#pages/users/model/search-draft.ts";
import { maximumKeywordLength } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

function SearchFields({ keyword }: Readonly<{ keyword: string }>): ReactElement {
  const [draft, setDraft] = useSearchDraft(keyword);
  const skippingKeyword = useRef(false);
  const navigate = useNavigate();
  const applyKeyword = useDebouncedCallback(
    (next: string) => {
      const trimmed = next.trim();
      void navigate({
        replace: true,
        search: trimmed === "" ? {} : { keyword: trimmed },
        to: "/users",
      });
    },
    { wait: 300 },
  );
  useEffect(() => {
    if (skippingKeyword.current) {
      skippingKeyword.current = false;
      return;
    }
    setDraft(keyword);
  }, [keyword, setDraft]);
  function handleValueChange(next: string): void {
    skippingKeyword.current = true;
    setDraft(next);
    applyKeyword(next);
  }
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    const trimmed = draft.trim();
    void navigate({
      replace: true,
      search: trimmed === "" ? {} : { keyword: trimmed },
      to: "/users",
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
          onValueChange={handleValueChange}
        />
        <Button type="submit" variant="primary">
          検索
        </Button>
      </form>
    </search>
  );
}

export { SearchFields };
