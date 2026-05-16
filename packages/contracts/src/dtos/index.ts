export { RegisterCustomerSchema, type RegisterCustomerDto } from './auth.js';

export {
  RegisterCustomerInputSchema,
  type RegisterCustomerInputDto,
  RegisterCustomerResponseSchema,
  type RegisterCustomerResponseDto,
  AcquisitionSourceSchema,
  AcquisitionInputSchema,
  type AcquisitionInputDto,
} from './identity/index.js';

export {
  CreateBookingSchema,
  type CreateBookingDto,
  BookingResponseSchema,
  type BookingResponseDto,
  BookingStatusEnum,
  type BookingStatus,
  BOOKING_STATUSES,
} from './booking.js';

export { CreateListingSchema, type CreateListingDto } from './catalog.js';

export {
  PaymentIntentResponseSchema,
  type PaymentIntentResponseDto,
  type PaymentIntentStatus,
  PAYMENT_INTENT_STATUSES,
} from './payment.js';
