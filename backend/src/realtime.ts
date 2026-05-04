import type { WebSocketServer } from 'ws';

/** Изоляция от `index.ts`, иначе цикл импортов может сломать `broadcast`. */
let wssRef: WebSocketServer | null = null;

export function initRealtime(wss: WebSocketServer): void {
  wssRef = wss;
}

export function broadcast(data: unknown): void {
  if (!wssRef) {
    console.warn('[broadcast] WebSocketServer не инициализирован, сообщение не отправлено');
    return;
  }
  const payload = JSON.stringify(data);
  wssRef.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}
