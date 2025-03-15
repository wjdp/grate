import type { TaskName, TaskState } from "#shared/tasks";

export interface SseMessage {
  message: string;
}

export interface SseNotification {
  title: string;
  message: string;
}

export interface SseTask {
  id: number;
  name: TaskName;
  state: TaskState;
  progress?: number;
  message?: string;
}

// Map of event names to their types
export interface SseMessageMap {
  message: SseMessage;
  notification: SseNotification;
  task: SseTask;
}

export type SseMessageType = keyof SseMessageMap;
