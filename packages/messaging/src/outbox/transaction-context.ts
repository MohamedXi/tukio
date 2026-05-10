import { AsyncLocalStorage } from 'node:async_hooks';
import type { EntityManager } from 'typeorm';

// AsyncLocalStorage-based transaction context.
// Services that want truly atomic outbox inserts wrap their business transaction with:
//   await TransactionContext.run(queryRunner.manager, async () => { ... });
// OutboxPublisher reads the current EntityManager from this context automatically.
// Falls back to DataSource.manager if no transaction is active.
const als = new AsyncLocalStorage<EntityManager>();

export const TransactionContext = {
  run: <T>(manager: EntityManager, callback: () => Promise<T>): Promise<T> =>
    als.run(manager, callback),

  getEntityManager: (): EntityManager | undefined => als.getStore(),
};
