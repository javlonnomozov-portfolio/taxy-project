"use strict";
// Domain enum'lari — barcha partlar uchun umumiy manba.
// Qarang: docs/tasks/06-domain-model.md
Object.defineProperty(exports, "__esModule", { value: true });
exports.LANGUAGES = exports.RatingCategory = exports.ActorType = exports.PanelRole = exports.BillingMode = exports.VehicleCategory = exports.OrderType = exports.ApprovalStatus = exports.DriverStatus = exports.OrderStatus = void 0;
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["CREATED"] = "CREATED";
    OrderStatus["DISPATCHING"] = "DISPATCHING";
    OrderStatus["ACCEPTED"] = "ACCEPTED";
    OrderStatus["CONFIRMED"] = "CONFIRMED";
    OrderStatus["ARRIVING"] = "ARRIVING";
    OrderStatus["ARRIVED"] = "ARRIVED";
    OrderStatus["IN_PROGRESS"] = "IN_PROGRESS";
    OrderStatus["COMPLETED"] = "COMPLETED";
    OrderStatus["CANCELLED_BY_CUSTOMER"] = "CANCELLED_BY_CUSTOMER";
    OrderStatus["CANCELLED_BY_DRIVER"] = "CANCELLED_BY_DRIVER";
    OrderStatus["CUSTOMER_NO_SHOW"] = "CUSTOMER_NO_SHOW";
    OrderStatus["NO_DRIVER"] = "NO_DRIVER";
    OrderStatus["CLOSED_BY_OPERATOR"] = "CLOSED_BY_OPERATOR";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
var DriverStatus;
(function (DriverStatus) {
    DriverStatus["OFFLINE"] = "OFFLINE";
    DriverStatus["ONLINE_IDLE"] = "ONLINE_IDLE";
    DriverStatus["OFFERED"] = "OFFERED";
    DriverStatus["ON_TRIP"] = "ON_TRIP";
})(DriverStatus || (exports.DriverStatus = DriverStatus = {}));
var ApprovalStatus;
(function (ApprovalStatus) {
    ApprovalStatus["PENDING"] = "pending";
    ApprovalStatus["APPROVED"] = "approved";
    ApprovalStatus["BLOCKED"] = "blocked";
})(ApprovalStatus || (exports.ApprovalStatus = ApprovalStatus = {}));
var OrderType;
(function (OrderType) {
    OrderType["STANDARD"] = "standard";
    OrderType["SCHEDULED"] = "scheduled";
    // zaxira (keyingi bosqich):
    OrderType["INTERCITY"] = "intercity";
    OrderType["DELIVERY"] = "delivery";
})(OrderType || (exports.OrderType = OrderType = {}));
var VehicleCategory;
(function (VehicleCategory) {
    VehicleCategory["STANDARD"] = "standard";
    VehicleCategory["COMFORT"] = "comfort";
    VehicleCategory["CARGO"] = "cargo";
})(VehicleCategory || (exports.VehicleCategory = VehicleCategory = {}));
var BillingMode;
(function (BillingMode) {
    BillingMode["SUBSCRIPTION"] = "subscription";
    BillingMode["PERCENT"] = "percent";
    BillingMode["HYBRID"] = "hybrid";
})(BillingMode || (exports.BillingMode = BillingMode = {}));
var PanelRole;
(function (PanelRole) {
    PanelRole["SUPER_ADMIN"] = "super_admin";
    PanelRole["ADMIN"] = "admin";
    PanelRole["OPERATOR"] = "operator";
})(PanelRole || (exports.PanelRole = PanelRole = {}));
var ActorType;
(function (ActorType) {
    ActorType["CUSTOMER"] = "customer";
    ActorType["DRIVER"] = "driver";
    ActorType["OPERATOR"] = "operator";
    ActorType["SYSTEM"] = "system";
})(ActorType || (exports.ActorType = ActorType = {}));
var RatingCategory;
(function (RatingCategory) {
    // Haydovchiga (rider beradi)
    RatingCategory["MANNERS"] = "manners";
    RatingCategory["DRIVING"] = "driving";
    RatingCategory["CAR_CONDITION"] = "car_condition";
    RatingCategory["PUNCTUALITY"] = "punctuality";
    // Riderga (haydovchi beradi)
    RatingCategory["PAYMENT_HONESTY"] = "payment_honesty";
    RatingCategory["READINESS"] = "readiness";
})(RatingCategory || (exports.RatingCategory = RatingCategory = {}));
exports.LANGUAGES = ['uz', 'ru'];
//# sourceMappingURL=enums.js.map