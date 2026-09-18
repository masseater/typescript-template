interface Account {
  readonly email: string;
  readonly name: string;
  readonly password: string;
}

const shortIdentifierLength = 8;

function newAccount(label: string): Account {
  const identifier = crypto.randomUUID();
  return {
    email: `${label}-${identifier}@example.test`,
    name: `${label} ${identifier.slice(0, shortIdentifierLength)}`,
    password: `journey-${identifier}`,
  };
}

export { newAccount };
export type { Account };
