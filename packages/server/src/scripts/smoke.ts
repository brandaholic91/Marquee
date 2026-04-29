import 'dotenv/config';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = `http://localhost:${process.env.PORT ?? 7892}`;

async function main() {
  console.log('🚀 Marquee smoke test');

  // 1. Create a thread
  const thread = await postJson('/api/threads', {});
  console.log(`✅ thread: ${thread.thread_id}`);

  // 2. Send a message that triggers Director to propose a brief
  await postJson('/api/messages', {
    thread_id: thread.thread_id,
    content: 'Kérek egy Instagram posztot a reggeli rituálé témára.',
  });
  console.log('📤 message sent, waiting for Director...');

  // 3. Poll until a draft brief shows up
  let brief: any = null;
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    const briefs = await getJson('/api/briefs');
    brief = briefs.find((b: any) => b.status === 'draft');
    if (brief) break;
  }
  if (!brief) throw new Error('no brief proposed within 120s');
  console.log(`✅ brief proposed: ${brief.id}`);

  // 4. Dispatch
  await postJson(`/api/briefs/${brief.id}/dispatch`, {});
  console.log('📨 dispatched, waiting for specialist...');

  // 5. Poll until awaiting_approval
  let deliverable: any = null;
  for (let i = 0; i < 90; i++) {
    await sleep(2000);
    const ds = await getJson('/api/deliverables?status=awaiting_approval');
    if (ds.length > 0) { deliverable = ds[0]; break; }
  }
  if (!deliverable) throw new Error('no deliverable submitted within 180s');
  console.log(`✅ deliverable awaiting approval: ${deliverable.id}`);

  // 6. Approve
  await postJson(`/api/deliverables/${deliverable.id}/approve`, {});
  console.log(`✅ approved → shipped`);
  console.log('🎉 smoke OK');
}

async function postJson(path: string, body: unknown) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

async function getJson(path: string) {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

main().catch((err) => { console.error(err); process.exit(1); });
