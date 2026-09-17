import { createSelectSchema } from "drizzle-orm/effect-schema";
import { user } from "./identity-schema.ts";

const UserRow = createSelectSchema(user);

export { UserRow };
