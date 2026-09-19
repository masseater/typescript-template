type Account = {
  readonly email: string;
  readonly name: string;
  readonly password: string;
};

const shortIdentifierLength = 8;

const newAccount = (role: string): Account => {
  const identifier = crypto.randomUUID();
  return {
    email: `${role}-${identifier}@example.test`,
    name: `${role} ${identifier.slice(0, shortIdentifierLength)}`,
    password: `journey-${identifier}`,
  };
};

export { newAccount };
export type { Account };
