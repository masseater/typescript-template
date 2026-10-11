import { atom, useAtomValue, useSetAtom } from "jotai";

type TodoFilter = "all" | "open" | "done";

const todoFilterAtom = atom<TodoFilter>("all");

const useTodoFilter = (): TodoFilter => useAtomValue(todoFilterAtom);

const useSelectTodoFilter = (): ((filter: TodoFilter) => void) => useSetAtom(todoFilterAtom);

export type { TodoFilter };
export { useSelectTodoFilter, useTodoFilter };
