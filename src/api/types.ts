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

// Core 1.1 (spec 30.10): the lifeguard list.
export type LifeguardList = Schemas['LifeguardList'];
export type LifeguardRow = Schemas['LifeguardRow'];

// Phase 2: daily quick sale, move, waitlist, ticket printing (spec 03).
export type DailySaleQuoteRequest = Schemas['DailySaleQuoteRequest'];
export type DailySaleQuote = Schemas['DailySaleQuote'];
export type DailySaleCreate = Schemas['DailySaleCreate'];
export type DailySaleResult = Schemas['DailySaleResult'];
export type DailySaleSettings = Schemas['DailySaleSettings'];
export type TicketPaymentMethod = Schemas['TicketPaymentMethod'];
export type AllocationConflict = Schemas['AllocationConflict'];
export type Pack = Schemas['Pack'];
export type Extra = Schemas['Extra'];
export type Zone = Schemas['Zone'];
export type BookingMoveRequest = Schemas['BookingMoveRequest'];
export type BookingChangeResult = Schemas['BookingChangeResult'];
export type BookingSwapRequest = Schemas['BookingSwapRequest'];
export type BookingSwapResult = Schemas['BookingSwapResult'];
export type MoveUndoInfo = Schemas['MoveUndoInfo'];
export type LastMove = Schemas['LastMove'];
export type MoveUndoResult = Schemas['MoveUndoResult'];
export type WaitlistEntry = Schemas['WaitlistEntry'];
export type WaitlistEntryDetail = Schemas['WaitlistEntryDetail'];
export type WaitlistEntryStatus = Schemas['WaitlistEntryStatus'];
export type WaitlistOffer = Schemas['WaitlistOffer'];
export type WaitlistOfferCreate = Schemas['WaitlistOfferCreate'];
export type WaitlistOfferStatus = Schemas['WaitlistOfferStatus'];
export type WaitlistSettings = Schemas['WaitlistSettings'];
export type PrintDocumentKind = Schemas['PrintDocumentKind'];
export type PrintRouteResolution = Schemas['PrintRouteResolution'];
export type PrintRouteUnreadyReason = Schemas['PrintRouteUnreadyReason'];
export type PrintJob = Schemas['PrintJob'];
export type PrintJobStatus = Schemas['PrintJobStatus'];

// Core 1.1 (spec 30.5): season calendar of a spot.
export type SpotCalendar = Schemas['SpotCalendar'];
export type SpotCalendarDay = Schemas['SpotCalendarDay'];
export type SpotCalendarCell = Schemas['SpotCalendarCell'];
export type SpotCalendarBooking = Schemas['SpotCalendarBooking'];
// Core 1.1 (M8): agreements, partners and the summary for the customer on the booking sheet.
export type AgreementRef = Schemas['AgreementRef'];
export type BookingPartnerShare = Schemas['BookingPartnerShare'];
export type BookingShareSummary = Schemas['BookingShareSummary'];
export type RequirementVerification = Schemas['RequirementVerification'];
// New booking on the fly: quote, hold and creation from the desk (core spec 7, 10).
export type BookingCreate = Schemas['BookingCreate'];
export type BookingQuote = Schemas['BookingQuote'];
export type Formula = Schemas['Formula'];
export type Hold = Schemas['Hold'];
export type HoldCreate = Schemas['HoldCreate'];
