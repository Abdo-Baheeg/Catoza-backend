export interface SyncPushOperation {
    operationId: string;
    householdId: string;
    entityType: "expense" | "settlement" | "note" | "shopping_item";
    entityId: string;
    op: "create" | "update" | "delete";
    baseVersion: number;
    payload: Record<string, unknown>;
}
export interface SyncOpResult {
    operationId: string;
    status: "applied" | "duplicate" | "conflict" | "rejected";
    error?: string;
    version?: number;
    serverEntity?: unknown;
}
export declare class SyncService {
    static push(userId: string, operations: SyncPushOperation[]): Promise<SyncOpResult[]>;
    static pull(userId: string, cursorStr?: string): Promise<{
        changes: {
            seq: string;
            householdId: string;
            entityType: string;
            entityId: string;
            op: string;
            version: number;
            createdAt: Date;
        }[];
        nextCursor: string;
        resyncRequired: boolean;
    }>;
}
