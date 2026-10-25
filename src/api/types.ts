// Named aliases of the generated contract types (src/api/generated, never
// edited by hand). Import API types from here, not from the generated file.
import type { components, paths } from '@/api/generated/schema';

export type { components, paths };

type Schemas = components['schemas'];

export type Meta = Schemas['Meta'];
export type Device = Schemas['Device'];
export type DevicePairRequest = Schemas['DevicePairRequest'];
export type DevicePairResult = Schemas['DevicePairResult'];
export type DevicePairingQRPayload = Schemas['DevicePairingQRPayload'];
export type DevicePlatform = Schemas['DevicePlatform'];
export type Establishment = Schemas['Establishment'];
export type Problem = Schemas['Problem'];
export type ProblemType = Schemas['ProblemType'];
export type Role = Schemas['Role'];

// Phase 1: operations, bookings, maps, roles (data and offline foundation).
export type Me = Schemas['Me'];
export type Membership = Schemas['Membership'];
export type Permission = Schemas['Permission'];
export type Slots = Schemas['Slots'];
export type Money = Schemas['Money'];
export type OperationsDay = Schemas['OperationsDay'];
export type OperationalSpot = Schemas['OperationalSpot'];
export type OperationalSpotStatus = Schemas['OperationalSpotStatus'];
export type OperationalBooking = Schemas['OperationalBooking'];
export type BookingStatus = Schemas['BookingStatus'];
export type BookingSummary = Schemas['BookingSummary'];
export type BookingList = Schemas['BookingList'];
export type BookingDetail = Schemas['BookingDetail'];
export type BeachMap = Schemas['Map'];
export type MapDocument = Schemas['MapDocument'];
export type PaymentMethod = Schemas['PaymentMethod'];

// Phase 1 operations: check-in by QR, cash desk, spot blocks.
export type Ticket = Schemas['Ticket'];
export type GateCheckInResult = Schemas['GateCheckInResult'];
export type CashSessionDetail = Schemas['CashSessionDetail'];
export type SpotBlockCreate = Schemas['SpotBlockCreate'];
export type SpotBlockList = Schemas['SpotBlockList'];

// Phase 3: essential reports (core spec 15.3).
export type YearComparisonReport = Schemas['YearComparisonReport'];
export type ComparisonMetric = Schemas['ComparisonMetric'];
export type ComparisonMetricKey = Schemas['ComparisonMetricKey'];
export type ComparisonPoint = Schemas['ComparisonPoint'];
export type ComparisonAlign = Schemas['ComparisonAlign'];
