// Common types shared across testcontainers + chaos + fixtures helpers.

export interface ContainerHandle {
  // Connection URL the service uses to reach the container (DSN, websocket, etc.).
  url: string;
  // Stops + removes the container. Idempotent.
  stop: () => Promise<void>;
}

export type FixtureOverrides<T> = Partial<T>;
