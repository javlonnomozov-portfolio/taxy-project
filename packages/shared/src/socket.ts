// Socket.IO event kontraktlari — front va backend uchun umumiy.
// Qarang: docs/tasks/06-domain-model.md (3-bo'lim)

import { OrderStatus, VehicleCategory } from './enums';

export const SOCKET_NAMESPACES = {
  DRIVER: '/driver',
  CUSTOMER: '/customer',
  OPS: '/ops',
} as const;

export interface LatLng {
  lat: number;
  lng: number;
}

// ---- /driver (client → server) ----
export interface DriverLocationPayload extends LatLng {
  heading?: number;
  speed?: number;
}
export interface OfferResponsePayload {
  orderId: string;
  accept: boolean;
}
export interface TripActionPayload {
  orderId: string;
}
export interface TripTrackSyncPayload {
  orderId: string;
  points: Array<LatLng & { at: string }>;
}

// ---- /driver (server → client) ----
export interface OrderOfferPayload {
  orderId: string;
  pickup: LatLng;
  pickupAddress?: string;
  distanceM: number;
  category: VehicleCategory;
  note?: string;
  customer: { phone: string; name?: string };
}
export interface OrderAssignedPayload {
  orderId: string;
  customer: { phone: string; name?: string };
  meterConfig: { baseFare: number; perKm: number; waitingPerMin: number };
}

// ---- /customer (server → client) ----
export interface OrderStatusPayload {
  orderId: string;
  status: OrderStatus;
  driver?: {
    name: string;
    phone: string;
    vehicle: string;
    plate: string;
    ratingAvg: number;
  };
  etaSec?: number;
}

// ---- /ops (server → client) ----
export type OpsAlertType = 'NO_DRIVER' | 'SOS' | 'REPUTATION' | 'STUCK';
export interface OpsAlertPayload {
  type: OpsAlertType;
  orderId?: string;
  message: string;
}

export const SOCKET_EVENTS = {
  driver: {
    online: 'driver:online',
    offline: 'driver:offline',
    location: 'driver:location',
    offerResponse: 'driver:offer_response',
    tripConfirm: 'trip:confirm',
    tripArrived: 'trip:arrived',
    tripStart: 'trip:start',
    tripComplete: 'trip:complete',
    tripNoShow: 'trip:no_show',
    tripCancel: 'trip:cancel',
    tripTrackSync: 'trip:track_sync',
    sos: 'sos',
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
} as const;
