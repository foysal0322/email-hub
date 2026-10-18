import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "./prisma";

const SESSION_COOKIE = "emailhub_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "default-secret-change-in-production-min32chars";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function createToken(user: SessionUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    SESSION_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token: string): SessionUser | null {
  try {
    return jwt.verify(token, SESSION_SECRET) as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setSessionCookie(user: SessionUser) {
  const token = createToken(user);
  cookies().set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export async function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function ensureDefaultAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@emailhub.local";
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const password = process.env.ADMIN_PASSWORD || "AdminPassword123!";
    const passwordHash = await hashPassword(password);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Lead Administrator",
        passwordHash,
        role: "admin",
      },
    });
  }
}
