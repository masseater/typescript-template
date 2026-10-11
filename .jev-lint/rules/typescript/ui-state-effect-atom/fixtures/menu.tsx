import { useAtom } from "@effect/atom-react";
import { Atom } from "effect/reactivity";
import type { ReactNode } from "react";

type MenuState = "closed" | "open";

const menuAtom = Atom.make<MenuState>("closed");

const Menu = ({ children }: { children: ReactNode }): ReactNode => {
  const [menu, setMenu] = useAtom(menuAtom);
  return (
    <nav>
      <button type="button" onClick={() => setMenu(menu === "open" ? "closed" : "open")}>
        Menu
      </button>
      {menu === "open" && children}
    </nav>
  );
};

export { Menu };
