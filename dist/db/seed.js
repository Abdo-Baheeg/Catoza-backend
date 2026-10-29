import { db, users, households, memberships, expenses, expenseShares, notes, chores, choreAssignments } from "./index.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { fileURLToPath } from "url";
export async function seed() {
    console.log("Seeding initial data...");
    const passwordHash = await bcrypt.hash("Password123!", 10);
    // 1. Users A (Alice), B (Bob), C (Charlie)
    const [alice] = await db
        .insert(users)
        .values({
        email: "alice@flatmates.local",
        displayName: "Alice",
        passwordHash,
    })
        .returning();
    const [bob] = await db
        .insert(users)
        .values({
        email: "bob@flatmates.local",
        displayName: "Bob",
        passwordHash,
    })
        .returning();
    const [charlie] = await db
        .insert(users)
        .values({
        email: "charlie@flatmates.local",
        displayName: "Charlie",
        passwordHash,
    })
        .returning();
    console.log(`Created users: Alice (${alice.id}), Bob (${bob.id}), Charlie (${charlie.id})`);
    // 2. Household
    const inviteCode = "MAADI2026";
    const inviteCodeHash = crypto.createHash("sha256").update(inviteCode).digest("hex");
    const [household] = await db
        .insert(households)
        .values({
        name: "Maadi Flat 4B",
        currency: "EGP",
        timezone: "Africa/Cairo",
        inviteCodeHash,
        createdBy: alice.id,
    })
        .returning();
    console.log(`Created household: ${household.name} (${household.id})`);
    // 3. Memberships
    await db.insert(memberships).values([
        {
            householdId: household.id,
            userId: alice.id,
            role: "admin",
            status: "active",
        },
        {
            householdId: household.id,
            userId: bob.id,
            role: "member",
            status: "active",
        },
        {
            householdId: household.id,
            userId: charlie.id,
            role: "member",
            status: "active",
        },
    ]);
    // 4. Milestone 3 Worked Example Expenses:
    // Expense 1: A pays 900 EGP (90,000 minor units) for Groceries, split equally among A, B, C (30,000 each)
    const [exp1] = await db
        .insert(expenses)
        .values({
        householdId: household.id,
        payerId: alice.id,
        title: "Weekly Groceries",
        amountMinor: 90000n, // 900.00 EGP
        currency: "EGP",
        category: "groceries",
        expenseDate: new Date(),
        splitMethod: "equal",
        status: "active",
        createdBy: alice.id,
    })
        .returning();
    await db.insert(expenseShares).values([
        { expenseId: exp1.id, userId: alice.id, shareMinor: 30000n },
        { expenseId: exp1.id, userId: bob.id, shareMinor: 30000n },
        { expenseId: exp1.id, userId: charlie.id, shareMinor: 30000n },
    ]);
    // Expense 2: B pays 600 EGP (60,000 minor units) for Utilities, split equally among A, B, C (20,000 each)
    const [exp2] = await db
        .insert(expenses)
        .values({
        householdId: household.id,
        payerId: bob.id,
        title: "Internet & Electricity",
        amountMinor: 60000n, // 600.00 EGP
        currency: "EGP",
        category: "utilities",
        expenseDate: new Date(),
        splitMethod: "equal",
        status: "active",
        createdBy: bob.id,
    })
        .returning();
    await db.insert(expenseShares).values([
        { expenseId: exp2.id, userId: alice.id, shareMinor: 20000n },
        { expenseId: exp2.id, userId: bob.id, shareMinor: 20000n },
        { expenseId: exp2.id, userId: charlie.id, shareMinor: 20000n },
    ]);
    // 5. Sample Note
    await db.insert(notes).values({
        householdId: household.id,
        authorId: alice.id,
        title: "WiFi & Rules",
        body: "WiFi: Flat4B-Guest / pass: flatmates2026. Bin day is Tuesday!",
        pinned: true,
        visibility: "all",
    });
    // 6. Sample Chore
    const [chore] = await db
        .insert(chores)
        .values({
        householdId: household.id,
        title: "Take out trash & recycling",
        rotationJson: [alice.id, bob.id, charlie.id],
        frequency: "weekly",
    })
        .returning();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    await db.insert(choreAssignments).values({
        choreId: chore.id,
        assigneeId: charlie.id,
        dueOn: nextWeek,
        status: "pending",
    });
    console.log("Seeding completed successfully!");
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    seed()
        .then(() => process.exit(0))
        .catch((err) => {
        console.error("Seeding failed:", err);
        process.exit(1);
    });
}
//# sourceMappingURL=seed.js.map