import { make } from "effect/unstable/reactivity/Atom";

type TodoFilter = "all" | "open" | "done";

const todoFilterAtom = make<TodoFilter>("all");

export type { TodoFilter };
export { todoFilterAtom };
