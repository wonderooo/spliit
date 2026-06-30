"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { groups, groupMembers } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { createGroupSchema } from "@/lib/validators";
import {
  ok,
  fail,
  type ActionResult,
  type ActionErrorCode,
} from "@/lib/action-result";

export async function createGroup(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session?.user) return fail("notSignedIn");

  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) {
    return fail((parsed.error.issues[0]?.message as ActionErrorCode) ?? "invalidInput");
  }
  const { name, description, baseCurrency } = parsed.data;

  const [group] = await db
    .insert(groups)
    .values({
      name,
      description: description || null,
      baseCurrency,
      createdBy: session.user.id,
    })
    .returning({ id: groups.id });

  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: session.user.id,
    role: "owner",
  });

  revalidatePath("/dashboard");
  return ok({ id: group.id });
}
