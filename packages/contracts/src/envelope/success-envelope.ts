import type { EnvelopeMethod } from './method.js';
import type { Meta } from './meta.js';
import type { Pagination } from './pagination.js';

type SuccessSingle<TData> = {
  method: EnvelopeMethod;
  code: number;
  data: TData | null;
  pagination?: never;
  meta: Meta;
};

type SuccessList<TData> = {
  method: EnvelopeMethod;
  code: number;
  data: TData[];
  pagination?: Pagination;
  meta: Meta;
};

export type SuccessEnvelope<TData> = SuccessSingle<TData> | SuccessList<TData>;
