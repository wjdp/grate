export interface SseMessage {
  message: string;
}

export interface SseNotification {
  title: string;
  message: string;
}

// Map of event names to their types
export interface SseMessageMap {
  message: SseMessage;
  notification: SseNotification;
}

export type SseMessageType = keyof SseMessageMap;
