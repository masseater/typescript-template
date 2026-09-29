import { SessionBadge } from "./session-badge";
import { TodoList } from "./todo-list";

export function HomePage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Todos</h1>
        <SessionBadge />
      </header>
      <TodoList />
    </main>
  );
}
