export declare class BalanceService {
    static getBalances(householdId: string): Promise<{
        balances: {
            paidMinor: string;
            owedSharesMinor: string;
            settlementsSentMinor: string;
            settlementsReceivedMinor: string;
            netBalanceMinor: string;
            user: {
                userId: string;
                displayName: string;
                email: string;
                avatarUrl: string | null;
                status: string;
            } | {
                userId: string;
                displayName: string;
                avatarUrl: null;
            };
            userId: string;
        }[];
        suggestions: {
            fromUser: string;
            fromUserName: string;
            toUser: string;
            toUserName: string;
            amountMinor: string;
        }[];
    }>;
}
