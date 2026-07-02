import { z } from "zod";
import { splitTypes } from "@/lib/db/schema";
import { CURRENCIES } from "@/lib/currency";
import { MEMBER_COLORS } from "@/lib/member-colors";

const currencyCodes = CURRENCIES.map((c) => c.code) as [string, ...string[]];

export const currencySchema = z.enum(currencyCodes);

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(80),
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
  .min(1, "nameRequired")
  .max(80);

export const updateMemberNameSchema = z.object({
  groupId: z.uuid(),
  name: memberNameSchema,
});
export type UpdateMemberNameInput = z.infer<typeof updateMemberNameSchema>;

/** Per-group accent color key a member picks when joining or in the members tab. */
export const memberColorSchema = z.enum(
  MEMBER_COLORS as unknown as [string, ...string[]],
);

export const updateMemberColorSchema = z.object({
  groupId: z.uuid(),
  color: memberColorSchema,
});
export type UpdateMemberColorInput = z.infer<typeof updateMemberColorSchema>;

export const removeMemberSchema = z.object({
  groupId: z.uuid(),
  userId: z.string().min(1),
});
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

const splitEntrySchema = z.object({
  userId: z.string().min(1),
  // Meaning depends on split type; validated in computeSplits.
  value: z.number().finite().optional(),
});

/** Receipt breakdown persisted so the item editor can be reopened. Money is in
 *  minor units of `currency`. Omitted on manual expenses; on update, absence
 *  leaves any existing breakdown untouched. */
export const receiptSchema = z.object({
  currency: currencySchema,
  items: z.array(
    z.object({
      name: z.string().trim().max(140),
      price: z.number().int().nonnegative(),
      assignees: z.array(z.string().min(1)),
    }),
  ),
  tax: z.number().int().nonnegative().nullable(),
  tip: z.number().int().nonnegative().nullable(),
});

export const createExpenseSchema = z
  .object({
    groupId: z.uuid(),
    description: z.string().trim().min(1, "descriptionRequired").max(140),
    category: z.string().trim().max(40).optional().or(z.literal("")),
    /** Amount in major units as entered by the user (e.g. 12.34). */
    amount: z.number().positive("amountPositive"),
    currency: currencySchema,
    paidBy: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalidDate"),
    splitType: z.enum(splitTypes),
    /** Exchange rate currency -> group base currency. */
    fxRate: z.number().positive(),
    splits: z.array(splitEntrySchema).min(1, "pickOnePerson"),
    /** Present when created/edited from a receipt scan. */
    receipt: receiptSchema.optional(),
  })
  .refine((v) => v.splits.length > 0, { message: "pickOnePerson" });
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const settlementSchema = z.object({
  groupId: z.uuid(),
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  amount: z.number().positive("amountPositive"),
  currency: currencySchema,
  fxRate: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalidDate"),
  note: z.string().trim().max(140).optional().or(z.literal("")),
});
export type SettlementInput = z.infer<typeof settlementSchema>;
