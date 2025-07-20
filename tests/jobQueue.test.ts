import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addJob } from '../server/jobQueue';

describe('jobQueue', () => {
  it('runs queued jobs', async () => {
    let ran = false;
    await new Promise<void>((resolve) => {
      addJob(async () => {
        ran = true;
        resolve();
      });
    });
     assert.ok(ran);
  });
});