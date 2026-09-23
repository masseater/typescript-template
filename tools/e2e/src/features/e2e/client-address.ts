const documentationPrefix = "203.0.113";
const hostCount = 254;

const syntheticClientAddress = (): string => {
  const [octet = 0] = crypto.getRandomValues(new Uint8Array(1));
  return `${documentationPrefix}.${(octet % hostCount) + 1}`;
};

const browserHeaders = (): Readonly<Record<string, string>> => {
  return { "cf-connecting-ip": syntheticClientAddress() };
};

export { browserHeaders };
