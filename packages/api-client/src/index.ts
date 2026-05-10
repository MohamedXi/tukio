// Minimal barrel — types + factory. All hooks must be imported via subpath
// exports (`@tukio/api-client/hooks/<domain>/<hook>`) for tree-shaking and
// to keep the client-only TanStack Query graph out of server bundles.
export { ApiError } from './types/api-error.js';
export { QueryKeys } from './types/query-keys.js';
export type { SearchParams, BookingFilter, VerificationFilter } from './types/query-keys.js';
export { createTukioApiClient } from './client/axios-client.js';
export type { AxiosClientConfig } from './client/types.js';
export {
  unwrapSuccessEnvelope,
  throwApiErrorFromEnvelope,
  isErrorEnvelope,
} from './client/envelope-handler.js';
export { ApiClientProvider, useApiClient } from './providers/api-client-context.js';
export { QueryProvider, createTukioQueryClient } from './providers/query-provider.js';
