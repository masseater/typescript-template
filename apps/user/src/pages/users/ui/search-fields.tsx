import { Button, Field } from "@template/ui";
import type { ReactElement } from "react";
import { maximumKeywordLength } from "@template/runtime/contracts";
import { useDebouncer } from "@tanstack/react-pacer";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

const keystrokeWait = 300;

function SearchFields({ keyword }: Readonly<{ keyword: string }>): ReactElement {
  const [draft, setDraft] = useState(keyword);
  const navigate = useNavigate();
  const debouncer = useDebouncer(
    (next: string): void => {
      void navigate({
        replace: true,
        search: next === "" ? {} : { keyword: next },
        to: "/users",
      });
    },
    { wait: keystrokeWait },
  );
  function change(value: string): void {
    setDraft(value);
    debouncer.maybeExecute(value.trim());
  }
  function submit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    debouncer.maybeExecute(draft.trim());
    debouncer.flush();
  }
  return (
    <search>
      <form onSubmit={submit} noValidate className="flex w-full max-w-search items-end gap-2">
        <Field
          label="名前で検索"
          name="keyword"
          type="search"
          maxLength={maximumKeywordLength}
          value={draft}
          onValueChange={change}
        />
        <Button type="submit" variant="primary">
          検索
        </Button>
      </form>
    </search>
  );
}

export { SearchFields };
