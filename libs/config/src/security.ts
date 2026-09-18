const cspNonceHeader = "x-csp-nonce";

const hstsMaxAgeSeconds = 31_536_000;
const hstsIncludesSubdomains = true;
const strictTransportSecurity = `max-age=${hstsMaxAgeSeconds}; includeSubDomains`;

export { cspNonceHeader, hstsIncludesSubdomains, hstsMaxAgeSeconds, strictTransportSecurity };
