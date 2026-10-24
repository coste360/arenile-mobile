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
