export declare const config: {
    port: number;
    nodeEnv: string;
    jwtSecret: string;
    jwtExpiresIn: string;
    supabase: {
        url: string;
        anonKey: string;
        serviceRoleKey: string;
    };
    email: {
        resendApiKey: string;
        fromEmail: string;
        fromName: string;
    };
    rateLimit: {
        windowMs: number;
        maxRequests: number;
    };
    cors: {
        origins: string[];
    };
    swiss: {
        defaultCountry: string;
        supportedLanguages: string[];
        defaultLanguage: string;
        vatRates: {
            standard: number;
            reduced: number;
            exempt: number;
        };
    };
};
export declare function validateConfig(): void;
export default config;
//# sourceMappingURL=index.d.ts.map