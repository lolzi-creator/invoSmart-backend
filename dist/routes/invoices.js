"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const invoiceController_1 = require("../controllers/invoiceController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.get('/stats', invoiceController_1.getInvoiceStats);
router.get('/', invoiceController_1.getInvoices);
router.post('/', (0, validation_1.validateRequest)({ body: validation_1.schemas.createInvoice }), invoiceController_1.createInvoice);
router.get('/:id', (0, validation_1.validateRequest)({ params: validation_1.schemas.id }), invoiceController_1.getInvoice);
router.put('/:id', (0, validation_1.validateRequest)({ params: validation_1.schemas.id }), invoiceController_1.updateInvoice);
router.delete('/:id', (0, validation_1.validateRequest)({ params: validation_1.schemas.id }), invoiceController_1.deleteInvoice);
router.patch('/:id/status', (0, validation_1.validateRequest)({
    params: validation_1.schemas.id,
    body: validation_1.schemas.updateInvoiceStatus
}), invoiceController_1.updateInvoiceStatus);
exports.default = router;
//# sourceMappingURL=invoices.js.map