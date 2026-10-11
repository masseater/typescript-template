import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/reactivity";

type InvoiceFilter = "all" | "paid" | "overdue";

const invoiceFilterAtom = Atom.make<InvoiceFilter>("all");

const useInvoiceFilter = (): InvoiceFilter => useAtomValue(invoiceFilterAtom);

const useSetInvoiceFilter = (): ((filter: InvoiceFilter) => void) => useAtomSet(invoiceFilterAtom);

export type { InvoiceFilter };
export { useInvoiceFilter, useSetInvoiceFilter };
