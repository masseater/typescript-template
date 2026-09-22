const PARENT_RP_ID_LABELS = 4;

const passkeyRpId = (origin: string): string => {
  const hostname = new URL(origin).hostname;
  const hostnameLabels = hostname.split(".");
  if (hostnameLabels.length < PARENT_RP_ID_LABELS) {
    return hostname;
  }
  return hostnameLabels.slice(1).join(".");
};

export { passkeyRpId };
