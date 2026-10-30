export declare class AuthService {
    static register(data: {
        email: string;
        password: string;
        displayName: string;
        avatarUrl?: string;
        instapayLink?: string;
        instapayUsername?: string;
    }): Promise<{
        user: {
            id: string;
            email: string;
            displayName: string;
            avatarUrl: string | null;
            instapayLink: string | null;
            instapayUsername: string | null;
            createdAt: Date;
        };
        tokens: {
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
        };
    }>;
    static login(data: {
        email: string;
        password: string;
        deviceName?: string;
    }): Promise<{
        user: {
            id: string;
            email: string;
            displayName: string;
            avatarUrl: string | null;
            createdAt: Date;
        };
        tokens: {
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
        };
    }>;
    static refresh(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
    static logout(refreshToken: string): Promise<void>;
    static getMe(userId: string): Promise<{
        id: string;
        email: string;
        displayName: string;
        avatarUrl: string | null;
        instapayLink: string | null;
        instapayUsername: string | null;
        createdAt: Date;
    }>;
    static updateProfile(userId: string, data: {
        displayName?: string;
        avatarUrl?: string;
        instapayLink?: string;
        instapayUsername?: string;
    }): Promise<{
        id: string;
        email: string;
        displayName: string;
        avatarUrl: string | null;
        instapayLink: string | null;
        instapayUsername: string | null;
        updatedAt: Date;
    }>;
    private static generateTokens;
}
