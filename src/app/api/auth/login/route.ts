import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { comparePassword, setSessionCookie, ensureDefaultAdmin } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await ensureDefaultAdmin();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await setSessionCookie({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "login",
        resourceType: "user",
        resourceId: user.id,
        details: "User logged in successfully",
      },
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error: unknown) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
