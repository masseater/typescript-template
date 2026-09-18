import type { Task } from "#shared/contract/index.ts";
import type { ReactElement } from "react";

function TaskRow({
  note,
  onSelect,
  selected,
  task,
}: Readonly<{
  note: string;
  onSelect: (id: string) => void;
  selected: boolean;
  task: typeof Task.Type;
}>): ReactElement {
  function handleSelectTask(): void {
    onSelect(task.id);
  }
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={handleSelectTask}
        className="flex w-full cursor-pointer flex-col rounded-md border border-border bg-card px-3 py-2 text-left hover:bg-card-hover aria-pressed:border-primary"
      >
        <span className="text-foreground">{task.title}</span>
        <span className="line-clamp-2 text-sm text-muted-foreground">
          {note === "" ? task.id : `${task.id}・${note}`}
        </span>
      </button>
    </li>
  );
}

export { TaskRow };
