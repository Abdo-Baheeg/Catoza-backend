export declare class HouseholdService {
    static createHousehold(userId: string, data: {
        name: string;
        currency?: string;
        timezone?: string;
    }): Promise<{
        household: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            currency: string;
            timezone: string;
            inviteCodeHash: string | null;
            inviteCodeExpiresAt: Date | null;
            createdBy: string;
            version: number;
        };
        membership: {
            id: string;
            updatedAt: Date;
            userId: string;
            version: number;
            householdId: string;
            role: string;
            status: string;
            joinedAt: Date;
        };
        inviteCode: string;
    }>;
    static joinByInviteCode(userId: string, inviteCode: string): Promise<{
        household: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            currency: string;
            timezone: string;
            inviteCodeHash: string | null;
            inviteCodeExpiresAt: Date | null;
            createdBy: string;
            version: number;
        };
        membership: {
            id: string;
            householdId: string;
            userId: string;
            role: string;
            status: string;
            version: number;
            joinedAt: Date;
            updatedAt: Date;
        };
    }>;
    static generateNewInviteCode(householdId: string): Promise<{
        inviteCode: string;
        expiresAt: Date;
    }>;
    static listMembers(householdId: string): Promise<{
        membershipId: string;
        role: string;
        status: string;
        joinedAt: Date;
        userId: string;
        displayName: string;
        email: string;
        avatarUrl: string | null;
        instapayLink: string | null;
        instapayUsername: string | null;
    }[]>;
    static updateMembership(membershipId: string, data: {
        role?: "admin" | "member";
        status?: "active" | "away" | "left";
    }): Promise<{
        id: string;
        householdId: string;
        userId: string;
        role: string;
        status: string;
        version: number;
        joinedAt: Date;
        updatedAt: Date;
    }>;
    static getUserHouseholds(userId: string): Promise<{
        household: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            currency: string;
            timezone: string;
            inviteCodeHash: string | null;
            inviteCodeExpiresAt: Date | null;
            createdBy: string;
            version: number;
        };
        role: string;
        status: string;
    }[]>;
}
