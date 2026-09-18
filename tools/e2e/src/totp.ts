import { URI } from "otpauth";

function currentTotpCode(uri: string): string {
  return URI.parse(uri).generate();
}

export { currentTotpCode };
