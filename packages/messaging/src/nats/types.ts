export interface NatsJetStreamConfig {
  url: string | string[];
  name?: string;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectTimeWait?: number;
  pingInterval?: number;
}

export interface StreamConfig {
  name: string;
  subjects: string[];
  storageType?: 'file' | 'memory';
  replicas?: number;
  retentionPolicy?: 'limits' | 'workqueue' | 'interest';
  maxAgeDays?: number;
}

export interface ConsumerConfig {
  name: string;
  streamName: string;
  deliverPolicy?: 'all' | 'last' | 'new';
  ackPolicy?: 'explicit' | 'none' | 'all';
  maxDeliver?: number;
  ackWaitSeconds?: number;
  filterSubject?: string;
}

export interface PubAck {
  stream: string;
  seq: number;
  duplicate: boolean;
}
