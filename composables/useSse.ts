import { H3Event, createEventStream } from "h3";
import { createHooks } from "hookable";
import type { SseMessageMap, SseMessageType } from "~/lib/hooks";

const defaultBusName = "default";

export interface ServerSentEvent {
  [key: string]: <T extends SseMessageType, R>(
    type: T,
    data: SseMessageMap[T],
  ) => R | void;
}

export const sseHooks = createHooks<ServerSentEvent>();

export const useSse = (event: H3Event, busName: string = defaultBusName) => {
  const eventStream = createEventStream(event);
  let counter = 0;

  // Used by Nginx to disable response buffering
  appendResponseHeader(event, "X-Accel-Buffering", "no");

  sseHooks.hook(busName, (type, data) => {
    console.log("got", type, data, "on", busName);
    eventStream.push({
      id: (counter++).toString(),
      event: type,
      retry: 2,
      data: JSON.stringify(data),
    });
  });

  const { push } = useSseEvent(busName);

  return {
    eventStream,
    push,
    close: (callback: () => void) => eventStream.onClosed(callback),
  };
};

export const useSseEvent = (busName: string = defaultBusName) => {
  return {
    push: <T extends SseMessageType>(name: T, data: SseMessageMap[T]) => {
      console.log("pushing", name, data, "on", busName);
      sseHooks.callHook(busName, name, data);
    },
  };
};
