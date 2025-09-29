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
    smtp: {
        host: string;
        port: number;
        user: string;
        pass: string;
    };
    rateLimit: {
        windowMs: number;
        maxRequests: number;
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