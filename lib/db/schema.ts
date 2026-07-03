import {
  pgTable,
  text,
  timestamp,
  boolean,
  bigint,
  numeric,
  uuid,
  date,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* -------------------------------------------------------------------------- */
/*  better-auth tables (shape matches `@better-auth/cli generate` output)     */
/* -------------------------------------------------------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
});

/* -------------------------------------------------------------------------- */
/*  Application tables                                                        */
/* -------------------------------------------------------------------------- */

export const splitTypes = ["equal", "exact", "percentage", "shares"] as const;
export type SplitType = (typeof splitTypes)[number];

export const memberRoles = ["owner", "member"] as const;
export type MemberRole = (typeof memberRoles)[number];

/**
 * Breakdown of a receipt-scanned expense, stored verbatim so the receipt item
 * editor can be reopened. All money is in minor units of `currency`; assignees
 * are member user ids who shared each item.
 */
export type ReceiptData = {
  currency: string;
  items: { name: string; price: number; assignees: string[] }[];
  tax: number | null;
  tip: number | null;
};

export const inviteStatuses = ["pending", "accepted", "revoked"] as const;
export type InviteStatus = (typeof inviteStatuses)[number];

export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  /** ISO 4217 base currency of the group (e.g. "USD"). */
  baseCurrency: text("base_currency").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Per-group display name. Null falls back to the user's account name. */
    name: text("name"),
    /** Per-group accent color key (see lib/member-colors). Null until assigned. */
    color: text("color"),
    role: text("role").$type<MemberRole>().default("member").notNull(),
    /**
     * A guest member added by the owner for someone who doesn't sign in. Backed
     * by a placeholder `user` row with no credentials, so expenses, splits and
     * settlements reference them like any member; the owner manages their
     * name/color.
     */
    synthetic: boolean("synthetic").notNull().default(false),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    /**
     * When the owner removed this member. Null = active. Soft delete keeps the
     * row so the member's expenses, splits, settlements, name and color still
     * resolve everywhere they already appear.
     */
    removedAt: timestamp("removed_at"),
  },
  (t) => [
    unique("group_members_group_user_unique").on(t.groupId, t.userId),
    index("group_members_group_idx").on(t.groupId),
    index("group_members_user_idx").on(t.userId),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    email: text("email"),
    token: text("token").notNull().unique(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").$type<InviteStatus>().default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (t) => [index("invitations_group_idx").on(t.groupId)],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    category: text("category"),
    /** Total amount in minor units of `currency` (e.g. cents). */
    amount: bigint("amount", { mode: "number" }).notNull(),
    /** ISO 4217 currency the expense was incurred in. */
    currency: text("currency").notNull(),
    /** Member who paid for the expense. */
    paidBy: text("paid_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    splitType: text("split_type").$type<SplitType>().notNull(),
    /** Exchange rate currency -> group.baseCurrency at expense date. */
    fxRate: numeric("fx_rate", { precision: 24, scale: 10 })
      .notNull()
      .default("1"),
    /** Cached amount converted to the group base currency, minor units. */
    baseAmount: bigint("base_amount", { mode: "number" }).notNull(),
    date: date("date").notNull(),
    /**
     * A personal expense the payer spent only on themselves. It's split solely
     * to the payer, so it nets to zero in the debt graph; it's surfaced
     * separately as per-person "own spending".
     */
    personal: boolean("personal").notNull().default(false),
    /** Receipt breakdown when scanned from a receipt; null for manual expenses. */
    receipt: jsonb("receipt").$type<ReceiptData>(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("expenses_group_idx").on(t.groupId)],
);

export const expenseSplits = pgTable(
  "expense_splits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** This member's share of the expense, minor units in expense currency. */
    amount: bigint("amount", { mode: "number" }).notNull(),
    /** Raw input used to compute the share (percentage or weight) for editing. */
    shareValue: numeric("share_value", { precision: 24, scale: 6 }),
  },
  (t) => [
    unique("expense_splits_expense_user_unique").on(t.expenseId, t.userId),
    index("expense_splits_expense_idx").on(t.expenseId),
  ],
);

export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    fxRate: numeric("fx_rate", { precision: 24, scale: 10 })
      .notNull()
      .default("1"),
    baseAmount: bigint("base_amount", { mode: "number" }).notNull(),
    date: date("date").notNull(),
    note: text("note"),
    /** Member who recorded the payment (not necessarily the payer). */
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("settlements_group_idx").on(t.groupId)],
);

export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    date: date("date").notNull(),
    base: text("base").notNull(),
    target: text("target").notNull(),
    rate: numeric("rate", { precision: 24, scale: 10 }).notNull(),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  },
  (t) => [unique("exchange_rates_unique").on(t.date, t.base, t.target)],
);

/* -------------------------------------------------------------------------- */
/*  Relations                                                                 */
/* -------------------------------------------------------------------------- */

export const groupsRelations = relations(groups, ({ many, one }) => ({
  members: many(groupMembers),
  expenses: many(expenses),
  settlements: many(settlements),
  invitations: many(invitations),
  creator: one(user, { fields: [groups.createdBy], references: [user.id] }),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(user, { fields: [groupMembers.userId], references: [user.id] }),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  group: one(groups, { fields: [expenses.groupId], references: [groups.id] }),
  payer: one(user, { fields: [expenses.paidBy], references: [user.id] }),
  splits: many(expenseSplits),
}));

export const expenseSplitsRelations = relations(expenseSplits, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseSplits.expenseId],
    references: [expenses.id],
  }),
  user: one(user, { fields: [expenseSplits.userId], references: [user.id] }),
}));

export const settlementsRelations = relations(settlements, ({ one }) => ({
  group: one(groups, {
    fields: [settlements.groupId],
    references: [groups.id],
  }),
  fromUser: one(user, {
    fields: [settlements.fromUserId],
    references: [user.id],
    relationName: "settlement_from",
  }),
  toUser: one(user, {
    fields: [settlements.toUserId],
    references: [user.id],
    relationName: "settlement_to",
  }),
}));

export type Group = typeof groups.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExpenseSplit = typeof expenseSplits.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type User = typeof user.$inferSelect;
