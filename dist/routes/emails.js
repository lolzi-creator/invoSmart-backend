"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const emailController_1 = require("../controllers/emailController");
console.log('📧 Loading email routes...');
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.post('/reminder', emailController_1.sendInvoiceReminder);
router.post('/notification', emailController_1.sendInvoiceNotification);
router.post('/bulk-reminders', emailController_1.sendBulkReminders);
router.post('/test', emailController_1.testEmail);
router.get('/templates', (req, res) => {
    res.json({
        success: true,
        message: 'Email templates endpoint - coming soon',
        data: []
    });
});
router.post('/invoice/:invoiceId', (req, res) => {
    res.json({
        success: true,
        message: 'Send invoice email - coming soon',
        data: null
    });
});
router.post('/reminder/:invoiceId', (req, res) => {
    res.json({
        success: true,
        message: 'Send reminder email - coming soon',
        data: null
    });
});
router.get('/preview/:invoiceId', (req, res) => {
    res.json({
        success: true,
        message: 'Preview email - coming soon',
        data: null
    });
});
console.log('📧 Email routes loaded successfully!');
exports.default = router;
//# sourceMappingURL=emails.js.map