import type { SseMessageMap, SseMessageType } from "~/lib/hooks";

let eventSource: EventSource;

export const useSseClient = () => {
  if (import.meta.server) {
    return {
      onMessage: <T extends SseMessageType>(
        name: T,
        callback: (data: SseMessageMap[T]) => void,
      ) => {},
      open: ref(false),
      close: () => {},
    };
  }

  const listeners = new Map<SseMessageType, (data: any) => void>();

  const reconnect = () => {
    if (eventSource) {
      eventSource.close();
    }
    eventSource = new EventSource("/api/sse");
    eventSource.onerror = (event) => {
      console.error("EventSource error:", event);
      eventSource.close();
      setTimeout(reconnect, 1000);
    };
    eventSource.onopen = () => {
      open.value = true;
      // Reattach listeners
      listeners.forEach((callback, name) => {
        eventSource.addEventListener(name, (event) => {
          const message = JSON.parse(event.data);
          callback(message);
        });
      });
    };
  };

  reconnect();
  const open = ref(eventSource.readyState === EventSource.OPEN);
  eventSource.onopen = () => (open.value = true);

  return {
    //
    onMessage: <T extends SseMessageType>(
      name: T,
      callback: (data: SseMessageMap[T]) => void,
    ) => {
      listeners.set(name, callback);
      eventSource.addEventListener(name, (event) => {
        const message = JSON.parse(event.data);
        callback(message);
      });
    },
    open,
    close: () => {
      eventSource.close();
    },
  };
};
