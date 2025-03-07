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
