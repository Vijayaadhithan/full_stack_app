import 'dotenv/config';
import request from 'supertest';
import { startServer } from '../server/index';
import { db } from '../server/db';
import { users } from '../shared/schema';
import { hashPasswordInternal } from '../server/auth';

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin12345';

  const username = `suspend_test_${Math.floor(Math.random() * 1e6)}`;
  const password = 'Passw0rd!123';
  const email = `${username}@example.com`;

  const server = await startServer(0);
  const agentAdmin = request.agent(server);
  const agentUser = request.agent(server);

  try {
    // 1) Admin login
    const adminLogin = await agentAdmin
      .post('/api/admin/login')
      .send({ email: adminEmail, password: adminPassword });
    if (adminLogin.status >= 300) {
      throw new Error(`Admin login failed: ${adminLogin.status} ${adminLogin.text}`);
    }

    // 2) Create a test user directly in DB
    const hashed = await hashPasswordInternal(password);
    const inserted = await db
      .insert(users)
      .values({
        username,
        password: hashed,
        role: 'customer',
        name: 'Suspend Test',
        phone: '0000000000',
        email,
      })
      .returning({ id: users.id });
    const userId = inserted[0].id;

    // 3) User can login before suspension
    const userLoginOk = await agentUser
      .post('/api/login')
      .send({ username, password });
    if (userLoginOk.status !== 200) {
      throw new Error(`Pre-suspend login failed unexpectedly: ${userLoginOk.status} ${userLoginOk.text}`);
    }

    // 4) Admin suspends the user
    const suspendResp = await agentAdmin
      .patch(`/api/admin/platform-users/${userId}/suspend`)
      .send({ isSuspended: true });
    if (suspendResp.status !== 200) {
      throw new Error(`Suspend failed: ${suspendResp.status} ${suspendResp.text}`);
    }

    // 5) User login should now fail
    const userLoginSuspended = await agentUser
      .post('/api/login')
      .send({ username, password });

    const ok = userLoginSuspended.status === 401; // blocked by LocalStrategy

    console.log(JSON.stringify({
      createdUserId: userId,
      preSuspendLoginStatus: userLoginOk.status,
      postSuspendLoginStatus: userLoginSuspended.status,
      passed: ok,
    }, null, 2));

    if (!ok) process.exitCode = 1;
  } catch (e: any) {
    console.error('Smoke test error:', e?.message || e);
    process.exitCode = 1;
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
}

main();

