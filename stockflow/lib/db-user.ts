import { prisma } from './prisma'
import { Role } from './auth'

export async function getUserFromDb(token: string) {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    return user as { id: string; email: string; name: string | null; role: Role; department: string | null; branchId: string | null } | null
  } catch {
    return null;
  }
}
