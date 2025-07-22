const url = process.argv[2] || 'http://localhost:5000/api/health';

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