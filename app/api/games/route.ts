import { requestCookieHeader } from "@/lib/requestCookies";
import { forward, proxyWs } from "@/lib/proxy";

export async function POST(request: Request) {
  const body = await request.text();
  const res = await proxyWs("/rooms", {
    method: "POST",
    body,
    headers: { cookie: await requestCookieHeader() },
  });
  return forward(res);
}
