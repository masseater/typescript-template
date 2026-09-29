import type { ReactNode } from "react";

import { SessionBadge } from "./session-badge";
import { TodoList } from "./todo-list";

const TITLE = "Todos";

const HomePage = (): ReactNode => (
  <main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
    <header className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">{TITLE}</h1>
      <SessionBadge />
    </header>
    <TodoList />
  </main>
);

export { HomePage };
