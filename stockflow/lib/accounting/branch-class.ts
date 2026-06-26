import type { AuthUser } from "@/lib/auth";

export type BranchClass = {
  id: string;
  code: string;
  name: string;
};

export async function requireUserBranchClass(
  tx: any,
  user: Pick<AuthUser, "branches">,
): Promise<BranchClass> {
  const branchId = user.branches[0]?.id;
  if (!branchId) {
    throw new Error("Your user account must be assigned to a branch before posting transactions");
  }

  const branch = await tx.branch.findFirst({
    where: { id: branchId },
    select: { id: true, code: true, name: true },
  });
  if (!branch) {
    throw new Error("Your assigned branch was not found in this organization");
  }
  return branch;
}
