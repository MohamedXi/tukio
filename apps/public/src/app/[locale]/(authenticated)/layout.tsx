// Route group `(authenticated)` — Story 0.14 (ADR-016).
// Wraps customer-area routes (`/account`, `/bookings`, `/favorites`,
// `/messages`, …). The auth-gate middleware (apps/public/src/middleware.ts)
// redirects unauthenticated requests to `/login?callback=...` before this
// layout ever renders.
//
// Story Epic 1+ replaces this stub with NavbarCustomer + sidebar (Story 0.5
// patterns). For now it stays a passthrough so the route group exists in the
// router tree without forcing a UI choice ahead of the auth flow being wired.
export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
