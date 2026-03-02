import { NextRequest, NextResponse } from "next/server";
import { evaluateLoginAttempt, type LoginAudience } from "@/lib/login-validation";

type Body = {
  email?: string;
  password?: string;
  loginAs?: string;
  audience?: LoginAudience;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Body;
  const audience: LoginAudience = body.audience === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER";

  try {
    const result = await evaluateLoginAttempt({
      email: body.email,
      password: body.password,
      loginAs: body.loginAs,
      audience,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, code: result.code }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to validate login.";
    return NextResponse.json({ ok: false, code: "INVALID_CREDENTIALS", error: message }, { status: 500 });
  }
}
