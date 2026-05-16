// Re-export shared base from @tukio/contracts. Kept as a local module to avoid
// breaking deep import paths in the domain layer; concrete exceptions in
// gateway-api continue to extend DomainException via this entrypoint.
export { DomainException } from '@tukio/contracts/exceptions/domain';
