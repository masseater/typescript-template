import { Email } from "@template/config";
import { Schema, SchemaGetter } from "effect";

const MAX_ALERT_RECIPIENTS = 10;
const Recipients = Schema.Array(Email).check(Schema.isLengthBetween(1, MAX_ALERT_RECIPIENTS));

export const AlertEnvironment = Schema.Struct({
  ALERT_FROM: Email,
  ALERT_TO: Schema.String.pipe(
    Schema.decodeTo(Recipients, {
      decode: SchemaGetter.transform((recipientList: string) => recipientList.split(",")),
      encode: SchemaGetter.transform((recipients: readonly string[]) => recipients.join(",")),
    }),
  ),
});
