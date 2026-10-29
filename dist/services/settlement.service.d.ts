export declare class SettlementService {
    static createSettlement(input: {
        householdId: string;
        fromUser: string;
        toUser: string;
        amountMinor: bigint | number | string;
        currency?: string;
        createdBy: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        createdBy: string;
        version: number;
        householdId: string;
        status: string;
        amountMinor: bigint;
        fromUser: string;
        toUser: string;
        confirmedBy: string | null;
        confirmedAt: Date | null;
    }>;
    static confirmSettlement(settlementId: string, actorId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        createdBy: string;
        version: number;
        householdId: string;
        status: string;
        amountMinor: bigint;
        fromUser: string;
        toUser: string;
        confirmedBy: string | null;
        confirmedAt: Date | null;
    }>;
    static rejectSettlement(settlementId: string, actorId: string): Promise<{
        id: string;
        householdId: string;
        fromUser: string;
        toUser: string;
        amountMinor: bigint;
        currency: string;
        status: string;
        createdBy: string;
        confirmedBy: string | null;
        confirmedAt: Date | null;
        version: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static listSettlements(householdId: string): Promise<{
        id: string;
        amountMinor: bigint;
        currency: string;
        status: string;
        createdAt: Date;
        confirmedAt: Date | null;
        version: number;
        fromUserId: string;
        fromUserName: string;
        toUserId: string;
    }[]>;
}
