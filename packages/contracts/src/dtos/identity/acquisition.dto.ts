import { z } from 'zod';
import { ACQUISITION_SOURCES } from '../../types/Acquisition.js';

const ACQUISITION_FIELD_MAX_LENGTH = 200;

export const AcquisitionSourceSchema = z.enum(ACQUISITION_SOURCES);

export const AcquisitionInputSchema = z.object({
  source: AcquisitionSourceSchema.default('unknown'),
  medium: z.string().max(ACQUISITION_FIELD_MAX_LENGTH).optional(),
  campaign: z.string().max(ACQUISITION_FIELD_MAX_LENGTH).optional(),
  content: z.string().max(ACQUISITION_FIELD_MAX_LENGTH).optional(),
  term: z.string().max(ACQUISITION_FIELD_MAX_LENGTH).optional(),
  referralId: z.uuid().optional(),
});

export type AcquisitionInputDto = z.infer<typeof AcquisitionInputSchema>;
