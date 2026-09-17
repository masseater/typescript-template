const httpStatus = {
  badRequest: 400,
  conflict: 409,
  forbidden: 403,
  notFound: 404,
  ok: 200,
  redirection: 300,
  tooManyRequests: 429,
  unauthorized: 401,
} as const;

const requestTimeout = {
  long: 30_000,
  probe: 500,
  readiness: 2000,
  service: 10_000,
  short: 5000,
} as const;

export { httpStatus, requestTimeout };
