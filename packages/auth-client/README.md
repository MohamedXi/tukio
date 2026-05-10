# @tukio/auth-client

Frontend auth for Tukio Next.js apps — Keycloak PKCE + hooks + Next.js middleware.

## Quick-start: AuthProvider

```tsx
// apps/customer/src/app/[locale]/layout.tsx
import { AuthProvider } from '@tukio/auth-client/provider';
export default function Layout({ children }) {
  return (
    <AuthProvider config={{ url: 'https://auth.tukio.one', realm: 'tukio', clientId: 'tukio-web' }}>
      {children}
    </AuthProvider>
  );
}
```

## Hooks

```ts
const { user, role, isAuthenticated } = useAuth();
const canAdmin = useRole(['admin-modo', 'admin-super']);
useRequireRole(['pro'], { onUnauthorized: () => router.push('/') });
const logout = useLogout();
```

## Next.js middleware (apps/\*/src/middleware.ts)

```ts
import { createKeycloakAuthMiddleware } from '@tukio/auth-client/middleware';
export default createKeycloakAuthMiddleware({
  protectedPaths: ['/account', '/cart'],
  loginRedirectUri: 'https://auth.tukio.one/realms/tukio/protocol/openid-connect/auth',
});
```
