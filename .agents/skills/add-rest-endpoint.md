# Skill: add a new REST endpoint

Use this when adding a new HTTP endpoint to a backend service. Covers
the controller layer, DTOs, envelope serialization, error mapping, role
gating, and the corresponding e2e test.

The canonical reference is **`apps/identity-svc/src/infrastructure/http/`**.

## Prerequisites

- Story file with the endpoint signature (method, path, params, body
  shape, response shape) clarified.
- The service already follows Pattern Pretre (see
  `.agents/skills/add-backend-service.md`).
- The use case behind the endpoint is **already written** (or will be
  written first). The controller is a thin adapter — never put business
  logic here.
- Read `.agents/context/rest-envelope.md` and `.agents/context/code-style.md`.

## Endpoint contract

- **Path**: `/v1/<plural-resource>[/<id>]` — kebab-case, EN, plural.
  Versioning is global (`app.enableVersioning`), so the `@Controller`
  decorator omits `/v1/`.
- **Method**: GET (read), POST (create), PATCH (partial update),
  PUT (full replace — rare), DELETE (soft-delete).
- **Response**: **always** wrapped in `SuccessEnvelope<T>` or
  `ErrorEnvelope` (built by `EnvelopeInterceptor` /
  `EnvelopeExceptionFilter`).
- **Auth**: `@UseGuards(KeycloakJwtGuard, RolesGuard)` + `@Roles(...)`
  is the default. `@Public()` for health / ready only.

## Step-by-step

1. **Define the request DTO** as a Zod schema in
   `packages/contracts/src/dtos/<domain>.ts`:

   ```ts
   import { z } from 'zod';

   export const ListBookingsQuerySchema = z.object({
     page: z.coerce.number().int().min(1).default(1),
     pageSize: z.coerce.number().int().min(1).max(100).default(20),
     status: z.enum(['requested', 'accepted', 'refused']).optional(),
   });

   export type ListBookingsQuery = z.infer<typeof ListBookingsQuerySchema>;
   ```

2. **Define the response DTO** (or aggregate-derived shape) in
   the same domain file. Use Zod when serialization matters.

3. **Wire the controller**:

   ```ts
   import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
   import { ParseUUIDPipe } from '@nestjs/common';
   import { ZodValidationPipe } from 'nestjs-zod';
   import { KeycloakJwtGuard } from '@tukio/auth/guards';
   import { RolesGuard } from '@tukio/auth/guards/roles';
   import { Roles } from '@tukio/auth/decorators';
   import { ListBookingsQuerySchema, type ListBookingsQuery } from '@tukio/contracts/dtos/booking';

   @Controller('bookings')
   @UseGuards(KeycloakJwtGuard, RolesGuard)
   export class BookingController {
     constructor(
       @Inject(USECASE_LIST_BOOKINGS) private readonly listBookings: ListBookingsUseCase,
       @Inject(USECASE_GET_BOOKING) private readonly getBooking: GetBookingUseCase,
     ) {}

     @Get()
     @Roles('client', 'pro', 'admin-support', 'admin-modo', 'admin-super')
     async list(
       @Query(new ZodValidationPipe(ListBookingsQuerySchema)) query: ListBookingsQuery,
     ): Promise<SuccessEnvelope<BookingView>> {
       const { items, page, pageSize, totalItems } = await this.listBookings.execute(query);
       return {
         method: 'GET',
         code: 200,
         data: items.map(toBookingView),
         pagination: {
           page,
           pageSize,
           totalItems,
           totalPages: Math.ceil(totalItems / pageSize),
           hasNextPage: page * pageSize < totalItems,
           hasPreviousPage: page > 1,
         },
         meta: this.metaBuilder.build(/* … */),
       };
     }

     @Get(':id')
     @Roles('client', 'pro', 'admin-support', 'admin-modo', 'admin-super')
     async getById(@Param('id', new ParseUUIDPipe()) id: string) {
       // Aggregate returned; EnvelopeInterceptor wraps it.
       return this.getBooking.execute(id);
     }
   }
   ```

4. **For mutations (POST / PATCH / DELETE)** use the same pattern with
   a body Zod schema:

   ```ts
   @Post()
   @Roles('client')
   async create(
     @Body(new ZodValidationPipe(CreateBookingSchema)) body: CreateBooking,
     @CurrentActor() actor: Actor,
   ): Promise<SuccessEnvelope<BookingView>> {
     const booking = await this.createBooking.execute({ ...body, customerId: actor.id });
     return { method: 'POST', code: 201, data: toBookingView(booking), meta: /* … */ };
   }
   ```

5. **Error handling.** Inside the use case, throw `DomainException`
   subclasses with stable `tukioCode`:

   ```ts
   throw new BookingSlotTakenException(slotId, /* tukioCode */ 'BOOKING-SLOT-TAKEN-001');
   ```

   The `EnvelopeExceptionFilter` catches it and produces an
   `ErrorEnvelope`. Add the exception class to
   `apps/<svc>/src/domain/exception/` if new.

6. **Add a Pino log line** for the endpoint at info / debug level on
   the controller's entry / exit (via interceptor or explicit
   `this.logger.info(...)`). Include `correlationId` and `actor.id`.

7. **E2E test** in `apps/<svc>/test/<feature>.e2e-spec.ts`:

   ```ts
   describe('GET /v1/bookings', () => {
     let app: INestApplication;
     beforeAll(async () => {
       setupJwksMock();
       app = await buildTestApp({
         /* config */
       });
     });
     afterAll(async () => {
       nock.cleanAll();
       await app.close();
     });

     it('returns 401 enveloped when no auth header', async () => {
       const res = await request(app.getHttpServer()).get('/v1/bookings');
       expect(res.status).toBe(401);
       expect(res.body).toMatchObject({
         method: 'GET',
         code: 401,
         error: { tukioCode: 'AUTH-NOT-AUTHENTICATED-002' },
         meta: { correlationId: expect.any(String), locale: 'fr' },
       });
     });

     it('returns 403 enveloped when insufficient role', async () => {
       const token = signTestToken({ realmRoles: ['client'] });
       const res = await request(app.getHttpServer())
         .get('/v1/bookings')
         .set('Authorization', `Bearer ${token}`);
       // (only if endpoint requires a higher role)
     });

     it('returns 200 enveloped with paginated data', async () => {
       const token = signTestToken({ realmRoles: ['admin-modo'] });
       const res = await request(app.getHttpServer())
         .get('/v1/bookings?page=1&pageSize=10')
         .set('Authorization', `Bearer ${token}`);
       expect(res.status).toBe(200);
       expect(res.body.data).toBeInstanceOf(Array);
       expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 10 });
     });
   });
   ```

8. **Update `@tukio/api-client`** (the typed REST client) so frontends
   can consume the new endpoint without re-defining types. The client
   wraps each domain in a typed surface:

   ```ts
   // packages/api-client/src/bookings.ts
   export const bookingsClient = {
     list: (params: ListBookingsQuery) =>
       http<SuccessEnvelope<BookingView>>('GET', '/v1/bookings', { query: params }),
     getById: (id: string) => http<SuccessEnvelope<BookingView>>('GET', `/v1/bookings/${id}`),
   };
   ```

9. **Run `/check`**:

   ```bash
   pnpm --filter=<svc> typecheck && lint && test && test:e2e
   pnpm --filter=@tukio/contracts typecheck   # if DTOs touched
   pnpm --filter=@tukio/api-client typecheck  # if client touched
   ```

10. **Smoke test live**:

    ```bash
    pnpm --filter=<svc> dev
    curl -i http://localhost:<port>/v1/bookings   # → 401 enveloped
    ```

11. **Commit + PR.** `feat(<svc>): add GET /v1/bookings endpoint — Story <X.Y>`.

## Anti-patterns to refuse

- Putting business logic in the controller — extract a use case.
- `@Controller('v1/bookings')` — versioning is global, controller path
  is `bookings`.
- Returning a TypeORM entity from the controller — return the aggregate
  or a typed view.
- Skipping `EnvelopeInterceptor` / `EnvelopeExceptionFilter` — wrap
  every response.
- `try { ... } catch (err) { return res.status(500) }` — let
  `EnvelopeExceptionFilter` handle errors.
- Skipping `@UseGuards(KeycloakJwtGuard, RolesGuard)` on a non-`@Public()`
  endpoint.
- Swallowing the actor (`@CurrentActor()`) and reading the JWT manually.
- Returning user input verbatim without validation — Zod always.
- Not updating `@tukio/api-client` — frontends end up duplicating types.
