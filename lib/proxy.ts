export async function proxyWs(
  path: string,
  init: RequestInit,
): Promise<Response> {
  const base = process.env.API_URL ?? "http://127.0.0.1:3001";
  try {
    return await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { error: "The table server is not available." },
      { status: 503 },
    );
  }
}

export function forward(res: Response): Promise<Response> {
  return res
    .json()
    .catch(() => ({ error: "The table could not be prepared." }))
    .then((body) =>
      Response.json(body, {
        status: res.status,
        headers: cookieHeaders(res),
      }),
    );
}

function cookieHeaders(res: Response): HeadersInit {
  const cookie = res.headers.get("set-cookie");
  return cookie ? { "set-cookie": cookie } : {};
}
