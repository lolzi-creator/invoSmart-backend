import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
export declare const validateRequest: (schema: {
    body?: Joi.ObjectSchema;
    query?: Joi.ObjectSchema;
    params?: Joi.ObjectSchema;
}) => (req: Request, res: Response, next: NextFunction) => void;
export declare const schemas: {
    pagination: Joi.ObjectSchema<any>;
    id: Joi.ObjectSchema<any>;
    companyId: Joi.ObjectSchema<any>;
    login: Joi.ObjectSchema<any>;
    register: Joi.ObjectSchema<any>;
    createCustomer: Joi.ObjectSchema<any>;
    updateCustomer: Joi.ObjectSchema<any>;
    createInvoice: Joi.ObjectSchema<any>;
    updateInvoice: Joi.ObjectSchema<any>;
    updateInvoiceStatus: Joi.ObjectSchema<any>;
    createQuote: Joi.ObjectSchema<any>;
    updateQuoteStatus: Joi.ObjectSchema<any>;
    createPayment: Joi.ObjectSchema<any>;
    matchPayment: Joi.ObjectSchema<any>;
    importPayments: Joi.ObjectSchema<any>;
    sendEmail: Joi.ObjectSchema<any>;
    sendReminder: Joi.ObjectSchema<any>;
    previewEmail: Joi.ObjectSchema<any>;
    createEmailTemplate: Joi.ObjectSchema<any>;
    updateEmailTemplate: Joi.ObjectSchema<any>;
};
//# sourceMappingURL=validation.d.ts.map