import { managerCookie, matches } from "@/lib/manager-session";

export const dynamic = "force-dynamic";
const headers = {"Cache-Control": "no-store"};

function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({error: "Invalid request origin."}, {status: 403, headers});
  const secret = process.env.TRAINING_ADMIN;
  const input = await request.json().catch(() => null) as {code?: unknown} | null;
  if (!secret || !matches(input?.code, secret)) {
    return Response.json({error: "Check your manager access code."}, {status: 401, headers});
  }
  return Response.json({signedIn: true}, {headers: {...headers, "Set-Cookie": managerCookie(secret)}});
}

export function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({error: "Invalid request origin."}, {status: 403, headers});
  return Response.json({signedIn: false}, {headers: {...headers, "Set-Cookie": managerCookie()}});
}
