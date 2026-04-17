const db = require('../config/db');

const registerUsage = db.transaction(({ quota_id, pages_used, observation }) => {
  const stmt = db.prepare(
    'INSERT INTO usage_logs (quota_id, pages_used, observation) VALUES (?, ?, ?)'
  );
  const result = stmt.run(quota_id, pages_used, observation || null);

  db.prepare('UPDATE quotas SET current_usage = current_usage + ? WHERE id = ?')
    .run(pages_used, quota_id);

  return db.prepare('SELECT * FROM usage_logs WHERE id = ?').get(result.lastInsertRowid);
});

function register(data) {
  return registerUsage(data);
}

function getByQuota(quotaId) {
  return db.prepare(
    'SELECT * FROM usage_logs WHERE quota_id = ? ORDER BY created_at DESC'
  ).all(quotaId);
}

module.exports = { register, getByQuota };
