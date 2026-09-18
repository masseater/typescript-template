import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { CommanderPage } from "#ui/pages/commander/index.ts";

import styles from "./styles.css?url";

const root = document.querySelector("#root");

if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      <link rel="stylesheet" href={styles} precedence="default" />
      <CommanderPage />
    </StrictMode>,
  );
}
