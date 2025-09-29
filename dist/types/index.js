"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailType = exports.DiscountType = exports.MatchConfidence = exports.InvoiceStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "ADMIN";
    UserRole["EMPLOYEE"] = "EMPLOYEE";
})(UserRole || (exports.UserRole = UserRole = {}));
var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["DRAFT"] = "DRAFT";
    InvoiceStatus["OPEN"] = "OPEN";
    InvoiceStatus["PARTIAL_PAID"] = "PARTIAL_PAID";
    InvoiceStatus["PAID"] = "PAID";
    InvoiceStatus["OVERDUE"] = "OVERDUE";
    InvoiceStatus["CANCELLED"] = "CANCELLED";
})(InvoiceStatus || (exports.InvoiceStatus = InvoiceStatus = {}));
var MatchConfidence;
(function (MatchConfidence) {
    MatchConfidence["HIGH"] = "HIGH";
    MatchConfidence["MEDIUM"] = "MEDIUM";
    MatchConfidence["LOW"] = "LOW";
    MatchConfidence["MANUAL"] = "MANUAL";
})(MatchConfidence || (exports.MatchConfidence = MatchConfidence = {}));
var DiscountType;
(function (DiscountType) {
    DiscountType["PERCENTAGE"] = "PERCENTAGE";
    DiscountType["FIXED_AMOUNT"] = "FIXED_AMOUNT";
})(DiscountType || (exports.DiscountType = DiscountType = {}));
var EmailType;
(function (EmailType) {
    EmailType["INVOICE"] = "INVOICE";
    EmailType["REMINDER_1"] = "REMINDER_1";
    EmailType["REMINDER_2"] = "REMINDER_2";
    EmailType["REMINDER_3"] = "REMINDER_3";
})(EmailType || (exports.EmailType = EmailType = {}));
//# sourceMappingURL=index.js.map