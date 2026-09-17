import { createContext } from "react";

const DropdownMenuClose = createContext<(() => void) | undefined>(undefined);

export { DropdownMenuClose };
