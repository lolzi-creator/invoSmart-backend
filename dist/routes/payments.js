"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentController_1 = require("../controllers/paymentController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.get('/stats', paymentController_1.getPaymentStats);
router.get('/debug', paymentController_1.debugPaymentMatching);
router.post('/import', paymentController_1.importPayments);
router.post('/import/csv', paymentController_1.importPaymentsCSV);
router.post('/import/mt940', paymentController_1.importPaymentsMT940);
router.post('/import/camt053', paymentController_1.importPaymentsCAMT053);
router.post('/auto-match', paymentController_1.runAutoMatch);
router.get('/', paymentController_1.getPayments);
router.post('/', (0, validation_1.validateRequest)({ body: validation_1.schemas.createPayment }), paymentController_1.createPayment);
router.get('/:id', (0, validation_1.validateRequest)({ params: validation_1.schemas.id }), paymentController_1.getPayment);
router.patch('/:id/match', (0, validation_1.validateRequest)({
    params: validation_1.schemas.id,
    body: validation_1.schemas.matchPayment
}), paymentController_1.matchPayment);
router.delete('/:id', (0, validation_1.validateRequest)({ params: validation_1.schemas.id }), paymentController_1.deletePayment);
exports.default = router;
//# sourceMappingURL=payments.js.map