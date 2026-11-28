import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/reactivity";

import type { todo } from "./todo.table.ts";

export type TodoFilter = "all" | (typeof todo.$inferSelect)["status"];

const todoFilterAtom = Atom.make<TodoFilter>("all");

export const useTodoFilter = (): TodoFilter => useAtomValue(todoFilterAtom);

export const useSelectTodoFilter = (): ((filter: TodoFilter) => void) => useAtomSet(todoFilterAtom);
