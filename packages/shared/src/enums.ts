// Domain enum'lari — barcha partlar uchun umumiy manba.
// Qarang: docs/tasks/06-domain-model.md

export enum OrderStatus {
  CREATED = 'CREATED',
  DISPATCHING = 'DISPATCHING',
  ACCEPTED = 'ACCEPTED',
  CONFIRMED = 'CONFIRMED',
  ARRIVING = 'ARRIVING',
  ARRIVED = 'ARRIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED_BY_CUSTOMER = 'CANCELLED_BY_CUSTOMER',
  CANCELLED_BY_DRIVER = 'CANCELLED_BY_DRIVER',
  CUSTOMER_NO_SHOW = 'CUSTOMER_NO_SHOW',
  NO_DRIVER = 'NO_DRIVER',
  CLOSED_BY_OPERATOR = 'CLOSED_BY_OPERATOR',
}

export enum DriverStatus {
  OFFLINE = 'OFFLINE',
  ONLINE_IDLE = 'ONLINE_IDLE',
  OFFERED = 'OFFERED',
  ON_TRIP = 'ON_TRIP',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  BLOCKED = 'blocked',
}

export enum OrderType {
  STANDARD = 'standard',
  SCHEDULED = 'scheduled',
  // zaxira (keyingi bosqich):
  INTERCITY = 'intercity',
  DELIVERY = 'delivery',
}

export enum VehicleCategory {
  STANDARD = 'standard',
  COMFORT = 'comfort',
  CARGO = 'cargo',
}

export enum BillingMode {
  SUBSCRIPTION = 'subscription',
  PERCENT = 'percent',
  HYBRID = 'hybrid',
}

export enum PanelRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  OPERATOR = 'operator',
}

export enum ActorType {
  CUSTOMER = 'customer',
  DRIVER = 'driver',
  OPERATOR = 'operator',
  SYSTEM = 'system',
}

export enum RatingCategory {
  // Haydovchiga (rider beradi)
  MANNERS = 'manners', // muomala
  DRIVING = 'driving', // haydash qobiliyati
  CAR_CONDITION = 'car_condition', // mashina holati
  PUNCTUALITY = 'punctuality', // vaqtida kelish
  // Riderga (haydovchi beradi)
  PAYMENT_HONESTY = 'payment_honesty', // to'lovda halollik
  READINESS = 'readiness', // tayyorlik
}

export const LANGUAGES = ['uz', 'ru'] as const;
export type Language = (typeof LANGUAGES)[number];
