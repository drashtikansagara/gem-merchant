import { requestCookieHeader } from "@/lib/requestCookies";
import { forward, proxyWs } from "@/lib/proxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomCode: string }> },
) {
  const { roomCode } = await params;
  const body = await request.text();
  const res = await proxyWs(`/rooms/${roomCode.toUpperCase()}/join`, {
    method: "POST",
    body,
    headers: { cookie: await requestCookieHeader() },
  });
  return forward(res);
}
