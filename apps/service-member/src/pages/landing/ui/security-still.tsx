import { AccountSecurity } from "@repo/auth-ui";

import type { ReactElement } from "react";

const sampleSession = {
  strong: true,
  user: {
    email: "hana@example.com",
    id: "sample-member",
    name: "山田 花子",
    role: "member",
    twoFactorEnabled: true,
  },
} as const;

function SecurityStill(): ReactElement {
  return (
    <div aria-hidden="true" inert className="rounded-lg border border-border bg-card p-4">
      <AccountSecurity
        passkeys={[{ id: "sample-passkey", name: "この端末" }]}
        session={sampleSession}
      />
    </div>
  );
}

export { SecurityStill };
