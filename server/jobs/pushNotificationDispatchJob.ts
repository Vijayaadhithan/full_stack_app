import logger from "../logger";
import { addJob, registerJobHandler } from "../jobQueue";
import type { IStorage } from "../storage";

const JOB_TYPE = "push-notification-dispatch";

export type PushNotificationDispatchPayload = {
  userId: number;
  title: string;
  body: string;
  type: string;
  relatedId?: number | null;
};

type PushNotificationDispatcher = IStorage & {
  dispatchPushNotificationJob?: (
    payload: PushNotificationDispatchPayload,
  ) => Promise<void>;
};

function parsePayload(
  data: Record<string, unknown>,
): PushNotificationDispatchPayload | null {
  const userId = typeof data.userId === "number" ? data.userId : Number(data.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  const title = typeof data.title === "string" ? data.title.trim() : "";
  const body = typeof data.body === "string" ? data.body.trim() : "";
  const type = typeof data.type === "string" ? data.type.trim() : "";
  if (!title || !body || !type) {
    return null;
  }

  const relatedRaw = data.relatedId;
  const relatedId =
    typeof relatedRaw === "number" && Number.isInteger(relatedRaw)
      ? relatedRaw
      : null;

  return {
    userId,
    title,
    body,
    type,
    relatedId,
  };
}

export function registerPushNotificationDispatchJob(storage: IStorage): void {
  registerJobHandler(JOB_TYPE, async (data, meta) => {
    const payload = parsePayload(data);
    if (!payload) {
      logger.warn({ data }, "[PushDispatchJob] Invalid payload; skipping");
      return;
    }

    const dispatcher = storage as PushNotificationDispatcher;
    if (typeof dispatcher.dispatchPushNotificationJob !== "function") {
      logger.warn(
        { jobType: JOB_TYPE },
        "[PushDispatchJob] Storage dispatcher unavailable; skipping",
      );
      return;
    }

    await dispatcher.dispatchPushNotificationJob(payload);
    logger.debug(
      {
        userId: payload.userId,
        requestId: meta.requestId,
        traceId: meta.traceId,
      },
      "[PushDispatchJob] Push notification dispatched",
    );
  });
}

export async function enqueuePushNotificationDispatch(
  payload: PushNotificationDispatchPayload,
): Promise<void> {
  await addJob(
    JOB_TYPE,
    {
      userId: payload.userId,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      relatedId: payload.relatedId ?? null,
    },
    { source: "system" },
  );
}
