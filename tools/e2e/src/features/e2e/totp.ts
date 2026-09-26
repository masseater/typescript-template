import { URI } from "otpauth";

const currentTotpCode = (uri: string): string => URI.parse(uri).generate();

export { currentTotpCode };
