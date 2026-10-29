export declare class InternalService {
    static runDailySweep(): Promise<{
        recurringProcessed: number;
        syncOperationsPruned: number;
        changeLogPruned: number;
    }>;
}
