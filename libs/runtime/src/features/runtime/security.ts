const cspNonceHeader = "x-csp-nonce";
const hstsIncludesSubdomains = true;
const hstsMaxAgeSeconds = 31536000;
const strictTransportSecurity = `max-age=${hstsMaxAgeSeconds}; includeSubDomains`;
export { cspNonceHeader, hstsIncludesSubdomains, hstsMaxAgeSeconds, strictTransportSecurity };
