"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = exports.asyncHandler = exports.errorHandler = exports.InternalServerError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = void 0;
const config_1 = require("../config");
class ValidationError extends Error {
    constructor(message, details) {
        super(message);
        this.details = details;
        this.statusCode = 400;
        this.isOperational = true;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends Error {
    constructor(message = 'Authentication required') {
        super(message);
        this.statusCode = 401;
        this.isOperational = true;
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends Error {
    constructor(message = 'Insufficient permissions') {
        super(message);
        this.statusCode = 403;
        this.isOperational = true;
        this.name = 'AuthorizationError';
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends Error {
    constructor(message = 'Resource not found') {
        super(message);
        this.statusCode = 404;
        this.isOperational = true;
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends Error {
    constructor(message = 'Resource conflict') {
        super(message);
        this.statusCode = 409;
        this.isOperational = true;
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
class InternalServerError extends Error {
    constructor(message = 'Internal server error') {
        super(message);
        this.statusCode = 500;
        this.isOperational = true;
        this.name = 'InternalServerError';
    }
}
exports.InternalServerError = InternalServerError;
const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let code = err.code || 'INTERNAL_ERROR';
    if (err.name === 'ValidationError') {
        statusCode = 400;
        code = 'VALIDATION_ERROR';
    }
    else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
        code = 'INVALID_TOKEN';
    }
    else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
        code = 'TOKEN_EXPIRED';
    }
    else if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID format';
        code = 'INVALID_ID';
    }
    if (config_1.config.nodeEnv === 'development') {
        console.error('Error:', {
            name: err.name,
            message: err.message,
            stack: err.stack,
            statusCode,
            code,
            url: req.originalUrl,
            method: req.method,
            body: req.body,
            query: req.query,
            params: req.params
        });
    }
    if (config_1.config.nodeEnv === 'production' && statusCode >= 500) {
        console.error('Server Error:', {
            message: err.message,
            stack: err.stack,
            url: req.originalUrl,
            method: req.method,
            timestamp: new Date().toISOString()
        });
    }
    const response = {
        success: false,
        error: message,
        code,
        timestamp: new Date().toISOString()
    };
    if (config_1.config.nodeEnv === 'development') {
        response.stack = err.stack;
        response.details = err;
    }
    res.status(statusCode).json(response);
};
exports.errorHandler = errorHandler;
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
const notFound = (req, res, next) => {
    const error = new NotFoundError(`Route ${req.originalUrl} not found`);
    next(error);
};
exports.notFound = notFound;
//# sourceMappingURL=errorHandler.js.map