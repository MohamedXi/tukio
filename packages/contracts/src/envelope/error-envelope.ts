import type { EnvelopeMethod } from './method.js';
import type { ErrorBody } from './error-body.js';
import type { Meta } from './meta.js';

export interface ErrorEnvelope {
  method: EnvelopeMethod;
  code: number;
  error: ErrorBody;
  meta: Meta;
}
