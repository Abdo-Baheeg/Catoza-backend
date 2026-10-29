export declare class HouseholdLifeService {
    static createNote(input: {
        householdId: string;
        authorId: string;
        recipientId?: string;
        title?: string;
        body: string;
        pinned?: boolean;
        visibility?: "all" | "private";
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        version: number;
        householdId: string;
        title: string | null;
        deletedAt: Date | null;
        authorId: string;
        body: string;
        recipientId: string | null;
        pinned: boolean;
        visibility: string;
    }>;
    static listNotes(householdId: string, currentUserId: string): Promise<{
        id: string;
        title: string | null;
        body: string;
        pinned: boolean;
        visibility: string;
        createdAt: Date;
        updatedAt: Date;
        version: number;
        authorId: string;
        authorName: string;
        recipientId: string | null;
    }[]>;
    static markNoteAsRead(noteId: string, userId: string): Promise<{
        success: boolean;
    }>;
    static deleteNote(noteId: string, userId: string): Promise<{
        success: boolean;
    }>;
    static createChore(input: {
        householdId: string;
        title: string;
        description?: string;
        rotationUserIds: string[];
        frequency?: string;
        firstDueOn?: Date | string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        version: number;
        householdId: string;
        title: string;
        description: string | null;
        rotationJson: unknown;
        frequency: string;
        isActive: boolean;
    }>;
    static listChores(householdId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        version: number;
        householdId: string;
        title: string;
        description: string | null;
        rotationJson: unknown;
        frequency: string;
        isActive: boolean;
    }[]>;
    static listChoreAssignments(householdId: string): Promise<{
        id: string;
        choreId: string;
        choreTitle: string;
        assigneeId: string;
        assigneeName: string;
        dueOn: Date;
        status: string;
        completedAt: Date | null;
        version: number;
    }[]>;
    static updateChoreAssignment(assignmentId: string, status: "completed" | "skipped", actorId: string): Promise<{
        id: string;
        choreId: string;
        assigneeId: string;
        dueOn: Date;
        status: string;
        completedAt: Date | null;
        version: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static addShoppingItem(input: {
        householdId: string;
        name: string;
        qty?: string;
        addedBy: string;
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        version: number;
        householdId: string;
        deletedAt: Date | null;
        qty: string | null;
        addedBy: string;
        boughtBy: string | null;
        boughtAt: Date | null;
    }>;
    static listShoppingItems(householdId: string): Promise<{
        id: string;
        name: string;
        qty: string | null;
        addedBy: string;
        addedByName: string;
        boughtBy: string | null;
        boughtAt: Date | null;
        version: number;
        createdAt: Date;
    }[]>;
    static updateShoppingItem(itemId: string, data: {
        name?: string;
        qty?: string;
        isBought?: boolean;
        boughtBy?: string;
    }): Promise<{
        id: string;
        householdId: string;
        name: string;
        qty: string | null;
        addedBy: string;
        boughtBy: string | null;
        boughtAt: Date | null;
        version: number;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
    }>;
    static convertShoppingItemsToExpense(input: {
        householdId: string;
        itemIds: string[];
        payerId: string;
        amountMinor: bigint | number | string;
        participantIds: string[];
    }): Promise<{
        shares: import("../domain/types.js").CalculatedShare[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        createdBy: string;
        version: number;
        householdId: string;
        status: string;
        payerId: string;
        title: string;
        notes: string | null;
        amountMinor: bigint;
        category: string;
        expenseDate: Date;
        splitMethod: string;
        receiptUrl: string | null;
        deletedAt: Date | null;
    }>;
    static createPoll(input: {
        householdId: string;
        question: string;
        createdBy: string;
        options: string[];
        closesAt?: Date | string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        createdBy: string;
        version: number;
        householdId: string;
        question: string;
        closesAt: Date | null;
    }>;
    static listPolls(householdId: string): Promise<{
        options: {
            votes: {
                pollOptionId: string;
                userId: string;
                voterName: string;
            }[];
            id: string;
            createdAt: Date;
            pollId: string;
            optionText: string;
        }[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
        createdBy: string;
        version: number;
        householdId: string;
        question: string;
        closesAt: Date | null;
    }[]>;
    static votePoll(pollOptionId: string, userId: string): Promise<{
        success: boolean;
    }>;
    static addAwayPeriod(input: {
        householdId: string;
        userId: string;
        startsOn: Date | string;
        endsOn: Date | string;
    }): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        householdId: string;
        startsOn: Date;
        endsOn: Date;
    }>;
    static listAwayPeriods(householdId: string): Promise<{
        id: string;
        userId: string;
        userName: string;
        startsOn: Date;
        endsOn: Date;
        createdAt: Date;
    }[]>;
}
