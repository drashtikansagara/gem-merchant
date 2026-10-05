import { requestCookieHeader } from "@/lib/requestCookies";
import { forward, proxyWs } from "@/lib/proxy";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ roomCode: string }> },
) {
  const { roomCode } = await params;
  const res = await proxyWs(`/rooms/${roomCode.toUpperCase()}/leave`, {
    method: "POST",
    body: "{}",
    headers: { cookie: await requestCookieHeader() },
  });
  return forward(res);
}
