import type { EnvelopeMethod } from './method.js';
import type { Meta } from './meta.js';
import type { Pagination } from './pagination.js';

/**
 * REST success envelope (ADR-014).
 *
 * `data` is `TData | TData[] | null`:
 * - single resource → `TData` or `null` if not found
 * - collection → `TData[]` (with optional `pagination`)
 *
 * Consumers should narrow with `Array.isArray(env.data)` to differentiate single vs list.
 * `pagination` should only be set on collection responses.
 */
export interface SuccessEnvelope<TData> {
  method: EnvelopeMethod;
  code: number;
  data: TData | TData[] | null;
  pagination?: Pagination;
  meta: Meta;
}
