import { App } from "./app.tsx";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import styles from "./styles.css?url";

const root = document.querySelector("#root");

if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      <link rel="stylesheet" href={styles} precedence="default" />
      <App />
    </StrictMode>,
  );
}
