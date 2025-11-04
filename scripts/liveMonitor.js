require("dotenv").config();

const normalize = (value) => value.replace(/\/$/, "");

const resolveMonitorUrl = () => {
  if (process.argv[2]) {
    return process.argv[2];
  }

  const envUrl = process.env.LIVE_MONITOR_URL?.trim();
  if (envUrl) {
    return envUrl;
  }

  const appBase = process.env.APP_BASE_URL?.trim();
  if (appBase) {
    return `${normalize(appBase)}/api/health`;
  }

  return "http://localhost:5000/api/health";
};

const url = resolveMonitorUrl();

async function check() {
  try {
    const res = await fetch(url);
    const ok = res.ok ? 'ok' : `status ${res.status}`;
    console.log(`[${new Date().toISOString()}] ${ok}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] error`, err.message);
  }
}

setInterval(check, 60_000);
check();
