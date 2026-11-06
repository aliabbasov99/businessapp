const assert = require('node:assert/strict');
const { test } = require('node:test');
const { connect } = require('./db/connection.cjs');

const origin = process.env.TEST_API_URL || 'http://127.0.0.1:8081';
async function request(route, body) {
  return fetch(`${origin}/api/${route}`, body === undefined ? undefined : {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
function numericPayload(value, key = '') {
  if (value === null) return;
  if (Array.isArray(value)) return value.forEach(item => numericPayload(item));
  if (typeof value === 'object') return Object.entries(value).forEach(([name, item]) => numericPayload(item, name));
  if ((key === 'id' || key.endsWith('Id')) && key !== 'taxId' || key.endsWith('Minor') || /^(occurredAt|createdAt|readAt|startsAt|endsAt|asOf)$/.test(key)) assert.ok(Number.isSafeInteger(value), `${key} must be a safe number`);
}

test('PostgreSQL and HTTP API integration', async t => {
  const admin = connect();
  const app = connect(false);
  await admin.connect();
  await app.connect();
  try {
    const response = await request('bootstrap');
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const snapshot = await response.json();
    await t.test('API reads database rows and preserves numeric IDs, dates and money', async () => {
      numericPayload(snapshot);
      const sales = await admin.query('SELECT * FROM sales WHERE id = $1', [snapshot.sales[0].id]);
      assert.equal(snapshot.sales[0].amountMinor, Number(sales.rows[0].amount_minor));
      assert.equal(snapshot.sales[0].occurredAt, sales.rows[0].occurred_at.getTime());
      const metadata = await admin.query('SELECT * FROM app_metadata WHERE id = 1');
      assert.equal(snapshot.metadata.activeUserId, metadata.rows[0].active_user_id);
      assert.ok(snapshot.periods.every(period => period.buckets.length > 0));
      assert.ok(snapshot.salesHistory.every(dataset => dataset.points.length > 0));
    });
    await t.test('foreign keys, business boundaries, money signs and period boundaries are enforced', async () => {
      async function rejects(sql, values, code) {
        await admin.query('BEGIN');
        try { await assert.rejects(admin.query(sql, values), error => error.code === code); }
        finally { await admin.query('ROLLBACK'); }
      }
      await rejects('UPDATE sales SET branch_id = -1 WHERE id = $1', [snapshot.sales[0].id], '23503');
      const stock = snapshot.stock[0];
      await rejects('UPDATE stock_balances SET business_id = -1 WHERE id = $1', [stock.id], '23503');
      const sale = snapshot.sales.find(row => row.type === 'sale');
      await rejects('UPDATE sales SET amount_minor = -1 WHERE id = $1', [sale.id], '23514');
      await rejects('UPDATE sales SET amount_minor = 9007199254740992 WHERE id = $1', [sale.id], '23514');
      const dataset = snapshot.salesHistory[0];
      const otherPeriod = snapshot.periods.find(period => period.id !== dataset.periodId);
      await rejects('UPDATE sales_points SET bucket_id = $1 WHERE dataset_id = $2 AND bucket_id = $3', [otherPeriod.buckets[0].id, dataset.id, dataset.points[0].bucketId], '23503');
    });
    await t.test('API database role cannot delete records or modify sales', async () => {
      await assert.rejects(app.query('DELETE FROM sales WHERE false'), error => error.code === '42501');
      await assert.rejects(app.query('UPDATE sales SET amount_minor = 0 WHERE false'), error => error.code === '42501');
    });
    await t.test('profile writes persist in PostgreSQL and are visible in the next bootstrap', async () => {
      const original = snapshot.users.find(user => user.id === snapshot.metadata.activeUserId);
      const edited = { name: `${original.name} [DB test]`, email: original.email, phone: original.phone ?? '' };
      try {
        const response = await request('profile', edited);
        assert.equal(response.status, 200);
        const db = await admin.query('SELECT name FROM users WHERE id = $1', [original.id]);
        assert.equal(db.rows[0].name, edited.name);
        const next = await (await request('bootstrap')).json();
        assert.equal(next.users.find(user => user.id === original.id).name, edited.name);
      } finally {
        await admin.query('UPDATE users SET name = $1, email = $2, phone = $3 WHERE id = $4', [original.name, original.email, original.phone, original.id]);
      }
      assert.equal((await request('profile', { name: '', email: 'bad', phone: '' })).status, 400);
    });
    await t.test('notification read state persists and malformed input is rejected', async () => {
      const original = snapshot.notifications[0];
      try {
        const response = await request('notifications', { id: original.id, read: original.readAt === null });
        assert.equal(response.status, 200);
        const next = (await response.json()).find(row => row.id === original.id);
        assert.equal(next.readAt === null, original.readAt !== null);
        const db = await admin.query('SELECT read_at FROM notifications WHERE id = $1', [original.id]);
        assert.equal(db.rows[0].read_at?.getTime() ?? null, next.readAt);
        assert.equal((await request('notifications', { id: '1 OR 1=1', read: true })).status, 400);
      } finally {
        await admin.query('UPDATE notifications SET read_at = $1 WHERE id = $2', [original.readAt === null ? null : new Date(original.readAt), original.id]);
      }
    });
  } finally {
    await admin.end();
    await app.end();
  }
});
