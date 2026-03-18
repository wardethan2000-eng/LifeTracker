export type RealtimeEventType =
  | "asset.updated"
  | "inventory.changed"
  | "maintenance.completed"
  | "hobby.session-progress";

export type RealtimeEvent = {
  type: RealtimeEventType;
  householdId: string;
  entityId?: string;
  occurredAt: string;
};

type RealtimeClient = {
  id: string;
  send: (event: RealtimeEvent) => void;
  close: () => void;
};

const householdClients = new Map<string, Map<string, RealtimeClient>>();

export function addRealtimeClient(householdId: string, client: RealtimeClient): void {
  const clients = householdClients.get(householdId) ?? new Map<string, RealtimeClient>();
  clients.set(client.id, client);
  householdClients.set(householdId, clients);
}

export function removeRealtimeClient(householdId: string, clientId: string): void {
  const clients = householdClients.get(householdId);

  if (!clients) {
    return;
  }

  clients.delete(clientId);

  if (clients.size === 0) {
    householdClients.delete(householdId);
  }
}

export function broadcastRealtimeEvent(event: RealtimeEvent): void {
  const clients = householdClients.get(event.householdId);

  if (!clients) {
    return;
  }

  for (const [clientId, client] of clients.entries()) {
    try {
      client.send(event);
    } catch {
      client.close();
      clients.delete(clientId);
    }
  }

  if (clients.size === 0) {
    householdClients.delete(event.householdId);
  }
}

export function createRealtimeEvent(
  type: RealtimeEventType,
  householdId: string,
  entityId?: string
): RealtimeEvent {
  return {
    type,
    householdId,
    ...(entityId ? { entityId } : {}),
    occurredAt: new Date().toISOString()
  };
}