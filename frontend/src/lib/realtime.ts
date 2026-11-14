/** Live CRM WebSocket — pushes changes from any browser to every open session. */

import { apiBaseUrl, getAccessToken } from "@/lib/api";
import { notifyDataChanged } from "@/lib/data-events";

function wsCrmUrl(token: string) {
  const http = apiBaseUrl();
  const ws = http.replace(/^http/i, (m) => (m.toLowerCase() === "https" ? "wss" : "ws"));
  return `${ws}/ws/crm/?token=${encodeURIComponent(token)}`;
}

type RealtimeHandle = { stop: () => void };

/**
 * Connect while the user is signed in. On any crm.changed event, refresh open views.
 * Auto-reconnects with backoff; call stop() on logout / unmount.
 */
export function startCrmRealtime(): RealtimeHandle {
  let socket: WebSocket | null = null;
  let stopped = false;
  let retry = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let debounce: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const bumpUi = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      debounce = null;
      notifyDataChanged();
    }, 150);
  };

  const connect = () => {
    if (stopped) return;
    const token = getAccessToken();
    if (!token) return;

    try {
      socket = new WebSocket(wsCrmUrl(token));
    } catch {
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      retry = 0;
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as { type?: string };
        if (data?.type === "crm.changed") bumpUi();
      } catch {
        // ignore malformed frames
      }
    };

    socket.onclose = () => {
      socket = null;
      if (!stopped) scheduleReconnect();
    };

    socket.onerror = () => {
      // onclose will run and reconnect
    };
  };

  const scheduleReconnect = () => {
    clearTimer();
    if (stopped) return;
    const delay = Math.min(15_000, 800 * 2 ** retry);
    retry += 1;
    timer = setTimeout(connect, delay);
  };

  connect();

  return {
    stop: () => {
      stopped = true;
      clearTimer();
      if (debounce) clearTimeout(debounce);
      try {
        socket?.close();
      } catch {
        // ignore
      }
      socket = null;
    },
  };
}
