import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

const geolocationState = {
  checkStatus: "granted",
  requestStatus: "granted",
  position: { coords: { latitude: 12.3, longitude: 45.6 } },
  throwOnCheck: false,
  throwOnRequest: false,
};

const geolocationApi = {
  async checkPermissions() {
    if (geolocationState.throwOnCheck) {
      throw new Error("check failed");
    }
    return { location: geolocationState.checkStatus };
  },
  async requestPermissions() {
    if (geolocationState.throwOnRequest) {
      throw new Error("request failed");
    }
    return { location: geolocationState.requestStatus };
  },
  async getCurrentPosition() {
    return geolocationState.position;
  },
};

const filesystemState = {
  throwOnRead: false,
  readErrorMessage: "",
  throwOnWrite: false,
  writeError: new Error("write failed"),
  readResult: { data: "demo" },
};

const filesystemApi = {
  async readFile() {
    if (filesystemState.throwOnRead) {
      throw new Error(filesystemState.readErrorMessage);
    }
    return filesystemState.readResult;
  },
  async writeFile() {
    if (filesystemState.throwOnWrite) {
      throw filesystemState.writeError;
    }
    return;
  },
};

const Directory = { Data: "data" } as const;
const Encoding = { UTF8: "utf8" } as const;

const notificationState = {
  checkStatus: "granted",
  requestStatus: "granted",
  scheduled: [] as unknown[],
};

const localNotificationsApi = {
  async checkPermissions() {
    return { display: notificationState.checkStatus };
  },
  async requestPermissions() {
    return { display: notificationState.requestStatus };
  },
  async schedule(payload: unknown) {
    notificationState.scheduled.push(payload);
  },
};

const pushState = {
  checkReceive: "prompt",
  requestReceive: "granted",
  registerCalls: 0,
  listeners: [] as string[],
};

const pushNotificationsApi = {
  async checkPermissions() {
    return { receive: pushState.checkReceive };
  },
  async requestPermissions() {
    return { receive: pushState.requestReceive };
  },
  async register() {
    pushState.registerCalls += 1;
  },
  addListener(event: string, handler: (...args: unknown[]) => void) {
    pushState.listeners.push(event);
    handler({});
    return { remove: async () => undefined };
  },
};

const capacitorState = { native: true };
const capacitorApi = {
  isNativePlatform() {
    return capacitorState.native;
  },
};

const globalAny = globalThis as any;
if (typeof globalAny.window === "undefined") {
  globalAny.window = {};
}

const {
  checkLocationPermission,
  requestLocationPermission,
  getCurrentPosition,
  checkStoragePermission,
  writeFileToStorage,
  checkNotificationPermission,
  requestNotificationPermission,
  scheduleLocalNotification,
  registerPushNotifications,
  addPushNotificationListeners,
  initializePushNotifications,
  __setPermissionsDepsForTesting,
} = await import("../client/src/lib/permissions");

beforeEach(() => {
  geolocationState.checkStatus = "granted";
  geolocationState.requestStatus = "granted";
  geolocationState.throwOnCheck = false;
  geolocationState.throwOnRequest = false;

  filesystemState.throwOnRead = false;
  filesystemState.readErrorMessage = "";
  filesystemState.throwOnWrite = false;

  notificationState.checkStatus = "granted";
  notificationState.requestStatus = "granted";
  notificationState.scheduled = [];

  pushState.checkReceive = "granted";
  pushState.requestReceive = "granted";
  pushState.registerCalls = 0;
  pushState.listeners = [];

  capacitorState.native = true;

  __setPermissionsDepsForTesting({
    Geolocation: geolocationApi as any,
    Filesystem: filesystemApi as any,
    Directory,
    Encoding,
    LocalNotifications: localNotificationsApi as any,
    PushNotifications: pushNotificationsApi as any,
    Capacitor: capacitorApi as any,
  });
});

describe("location permissions", () => {
  it("returns current permission status", async () => {
    geolocationState.checkStatus = "prompt";
    const status = await checkLocationPermission();
    assert.equal(status, "prompt");
  });

  it("defaults to denied when check throws", async () => {
    geolocationState.throwOnCheck = true;
    const status = await checkLocationPermission();
    assert.equal(status, "denied");
  });

  it("requests permission and returns status", async () => {
    geolocationState.requestStatus = "denied";
    const status = await requestLocationPermission();
    assert.equal(status, "denied");
  });

  it("returns null position when permission denied", async () => {
    geolocationState.requestStatus = "denied";
    const result = await getCurrentPosition();
    assert.equal(result, null);
  });

  it("returns coordinates when permission granted", async () => {
    geolocationState.position = { coords: { latitude: 1, longitude: 2 } };
    const result = await getCurrentPosition();
    assert.deepEqual(result, geolocationState.position);
  });
});

describe("storage helpers", () => {
  it("treats missing file error as accessible storage", async () => {
    filesystemState.throwOnRead = true;
    filesystemState.readErrorMessage = "File does not exist.";
    const ok = await checkStoragePermission();
    assert.equal(ok, true);
  });

  it("flags other storage errors", async () => {
    filesystemState.throwOnRead = true;
    filesystemState.readErrorMessage = "permission denied";
    const ok = await checkStoragePermission();
    assert.equal(ok, false);
  });

  it("writes and verifies files", async () => {
    const ok = await writeFileToStorage("demo.txt", "hello");
    assert.equal(ok, true);
  });

  it("handles write failures", async () => {
    filesystemState.throwOnWrite = true;
    const ok = await writeFileToStorage("demo.txt", "hello");
    assert.equal(ok, false);
  });
});

describe("notification helpers", () => {
  it("reads notification permission state", async () => {
    notificationState.checkStatus = "prompt";
    const status = await checkNotificationPermission();
    assert.equal(status, "prompt");
  });

  it("requests notification permission", async () => {
    notificationState.requestStatus = "denied";
    const status = await requestNotificationPermission();
    assert.equal(status, "denied");
  });

  it("schedules local notifications when permitted", async () => {
    await scheduleLocalNotification();
    assert.equal(notificationState.scheduled.length, 1);
  });

  it("skips scheduling when permission denied", async () => {
    notificationState.requestStatus = "denied";
    await scheduleLocalNotification();
    assert.equal(notificationState.scheduled.length, 0);
  });
});

describe("push notification helpers", () => {
  it("returns false when platform is not native", async () => {
    capacitorState.native = false;
    const result = await registerPushNotifications();
    assert.equal(result, false);
    assert.equal(pushState.registerCalls, 0);
  });

  it("registers when permission eventually granted", async () => {
    pushState.checkReceive = "prompt";
    pushState.requestReceive = "granted";
    const result = await registerPushNotifications();
    assert.equal(result, true);
    assert.equal(pushState.registerCalls, 1);
  });

  it("stops when permission denied after prompt", async () => {
    pushState.checkReceive = "prompt";
    pushState.requestReceive = "denied";
    const result = await registerPushNotifications();
    assert.equal(result, false);
    assert.equal(pushState.registerCalls, 0);
  });

  it("attaches listeners only on native platforms", () => {
    capacitorState.native = false;
    addPushNotificationListeners();
    assert.equal(pushState.listeners.length, 0);
  });

  it("adds expected listeners when native", () => {
    addPushNotificationListeners();
    assert.deepEqual(pushState.listeners, [
      "registration",
      "registrationError",
      "pushNotificationReceived",
      "pushNotificationActionPerformed",
    ]);
  });

  it("initializes push flow only on native platform", async () => {
    capacitorState.native = false;
    await initializePushNotifications();
    assert.equal(pushState.registerCalls, 0);

    capacitorState.native = true;
    pushState.listeners = [];
    await initializePushNotifications();
    assert.equal(pushState.registerCalls > 0, true);
    assert.equal(pushState.listeners.length, 4);
  });
});
