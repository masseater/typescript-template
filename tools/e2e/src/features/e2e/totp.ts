import { URI } from "otpauth";

const currentTotpCode = (uri: string): string => {
  return URI.parse(uri).generate();
};

export { currentTotpCode };
