import type { ReactElement } from "react";

function BackupCodeList({ codes }: Readonly<{ codes: readonly string[] }>): ReactElement {
  return (
    <ul aria-label="バックアップコード">
      {codes.map((backupCode) => (
        <li key={backupCode}>
          <code>{backupCode}</code>
        </li>
      ))}
    </ul>
  );
}

export { BackupCodeList };
