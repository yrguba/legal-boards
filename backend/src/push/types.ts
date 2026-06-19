export type PushMessagePayload = {
  title: string;
  body: string;
  eventType: string;
  route?: string;
  relatedId?: string;
  taskId?: string;
};

export type PushDispatchJob = {
  userIds: string[];
  excludeUserIds?: string[];
  payload: PushMessagePayload;
  dedupKey?: string;
};
