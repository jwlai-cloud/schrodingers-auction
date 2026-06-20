import { NextRequest, NextResponse } from "next/server";
import { signUp, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, displayName, password } = await req.json();

    if (!email || !displayName || !password) {
      return NextResponse.json({ error: "email, displayName and password are required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const sessionId = await signUp(email, displayName, password);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // DSQL unique constraint violation
    if (msg.includes("unique") || msg.includes("duplicate") || msg.includes("already exists")) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    console.error("[auth/signup]", msg);
    return NextResponse.json({ error: "Sign up failed. Please try again." }, { status: 500 });
  }
}
