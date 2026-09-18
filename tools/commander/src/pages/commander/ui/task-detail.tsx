import { Heading, Status } from "@repo/ui";

import { CommentForm } from "./comment-form.tsx";
import { TaskThread } from "./task-thread.tsx";

import type { Task } from "#shared/contract/index.ts";
import type { ReactElement } from "react";

function TaskDetail({ task }: Readonly<{ task: typeof Task.Type }>): ReactElement {
  return (
    <section
      aria-label="タスクの詳細"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <Heading as="h3" size="block">
        {task.title}
      </Heading>
      <p className="text-sm text-muted-foreground">
        {task.assignee === undefined ? task.id : `${task.id}・担当 ${task.assignee}`}
      </p>
      {task.description === "" ? undefined : (
        <p className="whitespace-pre-wrap text-foreground">{task.description}</p>
      )}
      {task.acceptance === "" ? undefined : (
        <p className="whitespace-pre-wrap text-foreground">完了の条件: {task.acceptance}</p>
      )}
      <TaskThread thread={task.thread} />
      {task.thread.length === 0 ? <Status>コメントはまだありません。</Status> : undefined}
      <CommentForm taskId={task.id} />
    </section>
  );
}

export { TaskDetail };
