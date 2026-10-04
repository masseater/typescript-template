import { Atom } from "effect/reactivity";

type TodoFilter = "all" | "open" | "done";

const todoFilterAtom = Atom.make<TodoFilter>("all");

export type { TodoFilter };
export { todoFilterAtom };
