"use strict";
// Socket.IO event kontraktlari — front va backend uchun umumiy.
// Qarang: docs/tasks/06-domain-model.md (3-bo'lim)
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOCKET_EVENTS = exports.SOCKET_NAMESPACES = void 0;
exports.SOCKET_NAMESPACES = {
    DRIVER: '/driver',
    CUSTOMER: '/customer',
    OPS: '/ops',
};
exports.SOCKET_EVENTS = {
    driver: {
        online: 'driver:online',
        offline: 'driver:offline',
        location: 'driver:location',
        offerResponse: 'driver:offer_response',
        tripArrived: 'trip:arrived',
        tripStart: 'trip:start',
        tripComplete: 'trip:complete',
        tripNoShow: 'trip:no_show',
        tripTrackSync: 'trip:track_sync',
        // server → client
        orderOffer: 'order:offer',
        orderOfferCancelled: 'order:offer_cancelled',
        orderAssigned: 'order:assigned',
        announcement: 'announcement',
    },
    customer: {
        orderStatus: 'order:status',
        driverLocation: 'driver:location',
    },
    ops: {
        orderUpdate: 'order:update',
        driverUpdate: 'driver:update',
        alert: 'alert',
    },
};
//# sourceMappingURL=socket.js.map