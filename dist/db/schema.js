import { pgTable, uuid, text, timestamp, integer, bigint, boolean, jsonb, bigserial, real, primaryKey, uniqueIndex, index, } from "drizzle-orm/pg-core";
// 1. Users
export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    avatarUrl: text("avatar_url"),
    instapayLink: text("instapay_link"),
    instapayUsername: text("instapay_username"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
// 2. Sessions (refresh tokens)
export const sessions = pgTable("sessions", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    deviceName: text("device_name"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
// 3. Devices (FCM push registration)
export const devices = pgTable("devices", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    fcmToken: text("fcm_token").notNull(),
    platform: text("platform").notNull().default("android"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
});
// 4. Households
export const households = pgTable("households", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    currency: text("currency").notNull().default("EGP"),
    timezone: text("timezone").notNull().default("Africa/Cairo"),
    inviteCodeHash: text("invite_code_hash"),
    inviteCodeExpiresAt: timestamp("invite_code_expires_at", { withTimezone: true }),
    createdBy: uuid("created_by")
        .notNull()
        .references(() => users.id),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
// 5. Memberships
export const memberships = pgTable("memberships", {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
        .notNull()
        .references(() => households.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // 'admin' | 'member'
    status: text("status").notNull().default("active"), // 'active' | 'away' | 'left'
    version: integer("version").notNull().default(1),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex("household_user_unique_idx").on(table.householdId, table.userId),
    index("membership_user_id_idx").on(table.userId),
]);
// 6. Away Periods
export const awayPeriods = pgTable("away_periods", {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
        .notNull()
        .references(() => households.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    startsOn: timestamp("starts_on", { withTimezone: true }).notNull(),
    endsOn: timestamp("ends_on", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
// 7. Expenses
export const expenses = pgTable("expenses", {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
        .notNull()
        .references(() => households.id, { onDelete: "cascade" }),
    payerId: uuid("payer_id")
        .notNull()
        .references(() => users.id),
    title: text("title").notNull(),
    notes: text("notes"),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull().default("EGP"),
    category: text("category").notNull().default("general"),
    expenseDate: timestamp("expense_date", { withTimezone: true }).notNull(),
    splitMethod: text("split_method").notNull().default("equal"), // 'equal' | 'exact' | 'percentage' | 'shares'
    status: text("status").notNull().default("active"), // 'active' | 'cancelled' | 'disputed'
    createdBy: uuid("created_by")
        .notNull()
        .references(() => users.id),
    version: integer("version").notNull().default(1),
    receiptUrl: text("receipt_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    index("expenses_household_date_idx").on(table.householdId, table.expenseDate),
]);
// 8. Expense Shares
export const expenseShares = pgTable("expense_shares", {
    expenseId: uuid("expense_id")
        .notNull()
        .references(() => expenses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    shareMinor: bigint("share_minor", { mode: "bigint" }).notNull(),
    splitValue: real("split_value"), // optional weight or percentage for reference
}, (table) => [
    primaryKey({ columns: [table.expenseId, table.userId] }),
]);
// 9. Expense Events (Audit Trail)
export const expenseEvents = pgTable("expense_events", {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
        .notNull()
        .references(() => expenses.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'created' | 'edited' | 'cancelled' | 'disputed' | 'resolved'
    actorId: uuid("actor_id")
        .notNull()
        .references(() => users.id),
    diffJson: jsonb("diff_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
// 10. Expense Comments
export const expenseComments = pgTable("expense_comments", {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
        .notNull()
        .references(() => expenses.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
        .notNull()
        .references(() => users.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
// 11. Settlements
export const settlements = pgTable("settlements", {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
        .notNull()
        .references(() => households.id, { onDelete: "cascade" }),
    fromUser: uuid("from_user")
        .notNull()
        .references(() => users.id),
    toUser: uuid("to_user")
        .notNull()
        .references(() => users.id),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull().default("EGP"),
    status: text("status").notNull().default("pending"), // 'pending' | 'confirmed' | 'rejected'
    createdBy: uuid("created_by")
        .notNull()
        .references(() => users.id),
    confirmedBy: uuid("confirmed_by").references(() => users.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
// 12. Recurring Templates
export const recurringTemplates = pgTable("recurring_templates", {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
        .notNull()
        .references(() => households.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull().default("EGP"),
    payerId: uuid("payer_id")
        .notNull()
        .references(() => users.id),
    category: text("category").notNull().default("recurring"),
    splitMethod: text("split_method").notNull().default("equal"),
    participantsJson: jsonb("participants_json"),
    rrule: text("rrule").notNull(), // iCal recurrence rule e.g. FREQ=MONTHLY;BYMONTHDAY=1
    nextRunOn: timestamp("next_run_on", { withTimezone: true }).notNull(),
    active: boolean("active").notNull().default(true),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
// 13. Notes
export const notes = pgTable("notes", {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
        .notNull()
        .references(() => households.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
        .notNull()
        .references(() => users.id),
    recipientId: uuid("recipient_id").references(() => users.id), // null = public to household
    title: text("title"),
    body: text("body").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    visibility: text("visibility").notNull().default("all"), // 'all' | 'private'
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
// 14. Note Reads
export const noteReads = pgTable("note_reads", {
    noteId: uuid("note_id")
        .notNull()
        .references(() => notes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    primaryKey({ columns: [table.noteId, table.userId] }),
]);
// 15. Chores
export const chores = pgTable("chores", {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
        .notNull()
        .references(() => households.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    rotationJson: jsonb("rotation_json"), // array of userIds
    frequency: text("frequency").notNull().default("weekly"),
    isActive: boolean("is_active").notNull().default(true),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
// 16. Chore Assignments
export const choreAssignments = pgTable("chore_assignments", {
    id: uuid("id").primaryKey().defaultRandom(),
    choreId: uuid("chore_id")
        .notNull()
        .references(() => chores.id, { onDelete: "cascade" }),
    assigneeId: uuid("assignee_id")
        .notNull()
        .references(() => users.id),
    dueOn: timestamp("due_on", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("pending"), // 'pending' | 'completed' | 'skipped'
    completedAt: timestamp("completed_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
// 17. Shopping Items
export const shoppingItems = pgTable("shopping_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
        .notNull()
        .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    qty: text("qty").default("1"),
    addedBy: uuid("added_by")
        .notNull()
        .references(() => users.id),
    boughtBy: uuid("bought_by").references(() => users.id),
    boughtAt: timestamp("bought_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
// 18. Polls
export const polls = pgTable("polls", {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
        .notNull()
        .references(() => households.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    createdBy: uuid("created_by")
        .notNull()
        .references(() => users.id),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
// 19. Poll Options
export const pollOptions = pgTable("poll_options", {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
        .notNull()
        .references(() => polls.id, { onDelete: "cascade" }),
    optionText: text("option_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
// 20. Poll Votes
export const pollVotes = pgTable("poll_votes", {
    pollOptionId: uuid("poll_option_id")
        .notNull()
        .references(() => pollOptions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    primaryKey({ columns: [table.pollOptionId, table.userId] }),
]);
// 21. Sync Operations (Idempotency Table)
export const syncOperations = pgTable("sync_operations", {
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    operationId: uuid("operation_id").notNull(),
    payloadHash: text("payload_hash").notNull(),
    resultJson: jsonb("result_json").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    primaryKey({ columns: [table.userId, table.operationId] }),
]);
// 22. Change Log (Server Sync Cursor)
export const changeLog = pgTable("change_log", {
    seq: bigserial("seq", { mode: "bigint" }).primaryKey(),
    householdId: uuid("household_id").notNull(),
    entityType: text("entity_type").notNull(), // 'expense' | 'settlement' | 'note' | 'shopping_item' | 'chore' | etc.
    entityId: uuid("entity_id").notNull(),
    op: text("op").notNull(), // 'upsert' | 'delete'
    version: integer("version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index("change_log_household_seq_idx").on(table.householdId, table.seq),
]);
//# sourceMappingURL=schema.js.map