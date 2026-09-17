import type { ReactElement } from "react";

function BackupCodeList({ codes }: Readonly<{ codes: readonly string[] }>): ReactElement {
  return (
    <ul aria-label="バックアップコード" className="flex w-full flex-col gap-1">
      {codes.map((backupCode) => (
        <li key={backupCode}>
          <code className="font-mono text-sm">{backupCode}</code>
        </li>
      ))}
    </ul>
  );
}

export { BackupCodeList };
