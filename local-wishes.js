/* Local wish storage for the single-player Wishing Tree build. */
(function (root) {
  const KEY = 'wishing-tree-local-wishes-v1';
  const LIFETIME = 7 * 24 * 60 * 60 * 1000;
  const DAILY_LIMIT = 3;

  function dayKey(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }

  function createStore(getStorage, now = Date.now) {
    function read(timestamp) {
      const raw = getStorage().getItem(KEY);
      if (raw === null) return [];
      const records = JSON.parse(raw);
      if (!Array.isArray(records)) throw new Error('Invalid local wishes');
      return records.filter(record => record && typeof record.id === 'string' &&
        typeof record.text === 'string' && record.text.trim() && Number.isFinite(record.at) &&
        timestamp - record.at < LIFETIME).map(record => ({
          id: record.id, text: record.text, name: typeof record.name === 'string' ? record.name : '',
          at: record.at, mine: true, stays: 0,
        }));
    }

    function countToday(records, timestamp) {
      return records.filter(record => dayKey(record.at) === dayKey(timestamp)).length;
    }

    return {
      key: KEY,
      list() {
        try { return read(now()); } catch { return []; }
      },
      left() {
        const timestamp = now();
        try { return Math.max(0, DAILY_LIMIT - countToday(read(timestamp), timestamp)); }
        catch { return DAILY_LIMIT; }
      },
      submit(text, name) {
        const timestamp = now();
        if (typeof text !== 'string' || !text.trim()) return { ok: false, reason: 'bad' };
        try {
          const records = read(timestamp);
          if (countToday(records, timestamp) >= DAILY_LIMIT) return { ok: false, reason: 'today' };
          const id = root.crypto?.randomUUID?.() || `${timestamp}-${Math.random().toString(36).slice(2)}`;
          const wish = { id, text: text.trim().normalize('NFC'), name: String(name || '').trim().normalize('NFC'), at: timestamp, mine: true, stays: 0 };
          records.push(wish);
          getStorage().setItem(KEY, JSON.stringify(records));
          return { ok: true, wish, records };
        } catch {
          return { ok: false, reason: 'storage' };
        }
      },
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { createStore };
  else root.WishingTreeLocalWishes = createStore(() => root.localStorage);
})(globalThis);
