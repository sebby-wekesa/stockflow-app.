"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";
import { scryptSync } from "crypto";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  const testHash = scryptSync(password, salt, 64).toString("hex");
  return hash === testHash;
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // Validate input
  const validation = loginSchema.safeParse({ email, password });

  if (!validation.success) {
    const errors = validation.error.flatten().fieldErrors;
    const firstError = errors.email?.[0] || errors.password?.[0] || "Invalid input";
    return { error: firstError };
  }

  // Find user in database
  const user = await prisma.user.findUnique({
    where: { email: validation.data.email },
  });

  if (!user || !verifyPassword(validation.data.password, user.password)) {
    return { error: "Invalid email or password. Please try again." };
  }

  // Create JWT token
  const cookieStore = await cookies();
  const sessionToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      department: user.department
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  cookieStore.set("auth-token", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  // Redirect based on role
  const redirectPath = user.role === 'ADMIN' ? '/dashboard' : '/operator_queue';
  redirect(redirectPath);
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete("auth-token");
  redirect("/login");
}
