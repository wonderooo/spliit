import { z } from "zod";
import { splitTypes } from "@/lib/db/schema";
import { CURRENCIES } from "@/lib/currency";

const currencyCodes = CURRENCIES.map((c) => c.code) as [string, ...string[]];

export const currencySchema = z.enum(currencyCodes);

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  baseCurrency: currencySchema,
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const inviteSchema = z.object({
  groupId: z.uuid(),
  email: z.email().trim().optional().or(z.literal("")),
});
export type InviteInput = z.infer<typeof inviteSchema>;

/** Per-group display name a member picks when joining or in the members tab. */
export const memberNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(80);

export const updateMemberNameSchema = z.object({
  groupId: z.uuid(),
  name: memberNameSchema,
});
export type UpdateMemberNameInput = z.infer<typeof updateMemberNameSchema>;

const splitEntrySchema = z.object({
  userId: z.string().min(1),
  // Meaning depends on split type; validated in computeSplits.
  value: z.number().finite().optional(),
});

export const createExpenseSchema = z
  .object({
    groupId: z.uuid(),
    description: z.string().trim().min(1, "Description is required").max(140),
    category: z.string().trim().max(40).optional().or(z.literal("")),
    /** Amount in major units as entered by the user (e.g. 12.34). */
    amount: z.number().positive("Amount must be greater than zero"),
    currency: currencySchema,
    paidBy: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
    splitType: z.enum(splitTypes),
    /** Exchange rate currency -> group base currency. */
    fxRate: z.number().positive(),
    splits: z.array(splitEntrySchema).min(1, "Pick at least one person"),
  })
  .refine((v) => v.splits.length > 0, { message: "Pick at least one person" });
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const settlementSchema = z.object({
  groupId: z.uuid(),
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  amount: z.number().positive("Amount must be greater than zero"),
  currency: currencySchema,
  fxRate: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  note: z.string().trim().max(140).optional().or(z.literal("")),
});
export type SettlementInput = z.infer<typeof settlementSchema>;
