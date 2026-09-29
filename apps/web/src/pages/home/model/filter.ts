import * as Atom from "effect/reactivity/Atom";

export type TodoFilter = "all" | "open" | "done";

export const todoFilterAtom = Atom.make<TodoFilter>("all");
