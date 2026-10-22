import { opsAuth } from "@/lib/ops/auth-http";
export async function POST(request: Request) { return opsAuth(request, "sign-in"); }
