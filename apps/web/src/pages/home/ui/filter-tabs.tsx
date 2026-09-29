import { useAtom } from "@effect/atom-react";

import { Button } from "#/shared/ui/button";

import { todoFilterAtom, type TodoFilter } from "../model/filter";

const FILTERS: ReadonlyArray<TodoFilter> = ["all", "open", "done"];

export function FilterTabs() {
  const [current, setCurrent] = useAtom(todoFilterAtom);
  return (
    <div className="flex gap-2">
      {FILTERS.map((filter) => (
        <Button
          key={filter}
          size="sm"
          variant={filter === current ? "default" : "outline"}
          onClick={() => setCurrent(filter)}
        >
          {filter}
        </Button>
      ))}
    </div>
  );
}
