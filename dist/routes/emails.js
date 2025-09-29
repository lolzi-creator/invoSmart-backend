"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const emailController_1 = require("../controllers/emailController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.get('/templates', emailController_1.getEmailTemplates);
router.post('/templates', (0, validation_1.validateRequest)({ body: validation_1.schemas.createEmailTemplate }), emailController_1.createEmailTemplate);
router.put('/templates/:id', (0, validation_1.validateRequest)({
    params: validation_1.schemas.id,
    body: validation_1.schemas.updateEmailTemplate
}), emailController_1.updateEmailTemplate);
router.delete('/templates/:id', (0, validation_1.validateRequest)({ params: validation_1.schemas.id }), emailController_1.deleteEmailTemplate);
router.post('/invoice/:invoiceId', (0, validation_1.validateRequest)({
    body: validation_1.schemas.sendEmail
}), emailController_1.sendInvoiceEmail);
router.post('/reminder/:invoiceId', (0, validation_1.validateRequest)({
    body: validation_1.schemas.sendReminder
}), emailController_1.sendReminderEmail);
router.get('/preview/:invoiceId', emailController_1.previewEmail);
exports.default = router;
//# sourceMappingURL=emails.js.map