import { make } from "effect/reactivity/Atom";

type TodoFilter = "all" | "open" | "done";

const todoFilterAtom = make<TodoFilter>("all");

export type { TodoFilter };
export { todoFilterAtom };
