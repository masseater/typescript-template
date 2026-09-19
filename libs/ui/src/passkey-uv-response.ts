import { isPasskeyOptionsPath, passkeyUVOptions } from "./protocol.ts";

const passkeyUVResponse = async (served: Response, servedUrl: string): Promise<Response> => {
  if (!served.ok) {
    return served;
  }
  const { pathname } = new URL(servedUrl);
  if (!isPasskeyOptionsPath(pathname)) {
    return served;
  }
  const passkeyOptions = passkeyUVOptions(await served.clone().json(), pathname);
  return new Response(JSON.stringify(passkeyOptions), {
    headers: served.headers,
    status: served.status,
    statusText: served.statusText,
  });
};

export { passkeyUVResponse };
