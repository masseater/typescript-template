const PARENT_RP_ID_LABELS = 4;

const passkeyRpId = (origin: string): string => {
  const hostname = new URL(origin).hostname;
  const labels = hostname.split(".");
  if (labels.length < PARENT_RP_ID_LABELS) {
    return hostname;
  }
  return labels.slice(1).join(".");
};

export { passkeyRpId };
