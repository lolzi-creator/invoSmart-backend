"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const customerController_1 = require("../controllers/customerController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.get('/stats', customerController_1.getCustomerStats);
router.post('/import', customerController_1.importCustomers);
router.get('/', customerController_1.getCustomers);
router.post('/', (0, validation_1.validateRequest)({ body: validation_1.schemas.createCustomer }), customerController_1.createCustomer);
router.get('/:id', (0, validation_1.validateRequest)({ params: validation_1.schemas.id }), customerController_1.getCustomer);
router.put('/:id', (0, validation_1.validateRequest)({ params: validation_1.schemas.id, body: validation_1.schemas.updateCustomer }), customerController_1.updateCustomer);
router.delete('/:id', (0, validation_1.validateRequest)({ params: validation_1.schemas.id }), customerController_1.deleteCustomer);
exports.default = router;
//# sourceMappingURL=customers.js.map