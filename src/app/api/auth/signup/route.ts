import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { signupSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const userCount = await db.user.count();
  if (userCount > 0) {
    return NextResponse.json(
      { error: "Setup already complete. Ask an admin to create your account." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  const user = await db.user.create({
    data: { name, email, passwordHash, role: "ADMIN" },
  });

  await createSession({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  });

  return NextResponse.json({ ok: true });
}
