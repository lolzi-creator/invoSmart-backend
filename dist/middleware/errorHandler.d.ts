import { Request, Response, NextFunction } from 'express';
export interface AppError extends Error {
    statusCode?: number;
    code?: string;
    isOperational?: boolean;
}
export declare class ValidationError extends Error {
    details?: any | undefined;
    statusCode: number;
    isOperational: boolean;
    constructor(message: string, details?: any | undefined);
}
export declare class AuthenticationError extends Error {
    statusCode: number;
    isOperational: boolean;
    constructor(message?: string);
}
export declare class AuthorizationError extends Error {
    statusCode: number;
    isOperational: boolean;
    constructor(message?: string);
}
export declare class NotFoundError extends Error {
    statusCode: number;
    isOperational: boolean;
    constructor(message?: string);
}
export declare class ConflictError extends Error {
    statusCode: number;
    isOperational: boolean;
    constructor(message?: string);
}
export declare class InternalServerError extends Error {
    statusCode: number;
    isOperational: boolean;
    constructor(message?: string);
}
export declare const errorHandler: (err: AppError, req: Request, res: Response, next: NextFunction) => void;
export declare const asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
export declare const notFound: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=errorHandler.d.ts.map