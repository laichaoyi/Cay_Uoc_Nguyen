const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DAY = 86400000;
const LIFETIME = 7 * DAY;
const DAILY_LIMIT = 3;
const VISIBLE_LIMIT = 30;
const dayKey = timestamp => new Date(timestamp + 7 * 3600000).toISOString().slice(0, 10);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function publicWish(wish, owner) {
  return { id: wish.id, text: wish.text, name: wish.name, at: wish.at, mine: wish.owner === owner, stays: wish.stays || 0 };
}

// Local shared mode is only for testing. Render must use the remote database.
function fileStore(filename) {
  let wishes = [];
  if (fs.existsSync(filename)) wishes = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const prune = () => { wishes = wishes.filter(w => Date.now() - w.at < LIFETIME); };
  function persist() {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    const tmp = `${filename}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(wishes), { mode: 0o600 });
    fs.renameSync(tmp, filename);
  }
  function snapshot(owner) {
    prune();
    const left = Math.max(0, DAILY_LIMIT - wishes.filter(w => w.owner === owner && dayKey(w.at) === dayKey(Date.now())).length);
    return { mode: 'shared', records: wishes.slice().sort((a,b) => b.at-a.at).slice(0,VISIBLE_LIMIT).reverse().map(w => publicWish(w,owner)), left };
  }
  return {
    snapshot,
    submit(owner, requestId, text, name) {
      prune();
      let wish = wishes.find(w => w.owner === owner && w.requestId === requestId);
      if (wish) return { ok: true, wish: publicWish(wish, owner), ...snapshot(owner) };
      if (!snapshot(owner).left) return { ok: false, reason: 'today', ...snapshot(owner) };
      wish = { id: crypto.randomUUID(), owner, requestId, text, name, at: Date.now(), stays: 0, readers: [] };
      wishes.push(wish);
      try { persist(); } catch (e) { wishes.pop(); throw e; }
      return { ok: true, wish: publicWish(wish,owner), ...snapshot(owner) };
    },
    read(owner,id) {
      prune();
      const w = wishes.find(w => w.id === id);
      if (w && w.owner !== owner && !w.readers.includes(owner)) {
        w.readers.push(owner); w.stays++;
        try { persist(); } catch(e) { w.readers.pop(); w.stays--; throw e; }
      }
      return { ok: true };
    },
  };
}

function supabaseStore(url, key, fetchImpl = fetch) {
  const base = new URL(url);
  if (base.protocol !== 'https:' || base.pathname !== '/' || base.username || base.password || base.search || base.hash) throw new Error('SUPABASE_URL must be the HTTPS Project URL.');
  const headers = { apikey: key, 'Content-Type': 'application/json', 'User-Agent': 'WishingTreeServer/11' };
  // Legacy service_role JWTs need the Authorization header; new sb_secret keys use apikey alone.
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  async function rpc(method, params) {
    const response = await fetchImpl(new URL(`/rest/v1/rpc/${method}`, base), { method: 'POST', headers, body: JSON.stringify(params), signal: AbortSignal.timeout(12000) });
    if (!response.ok) {
      // Never print request headers or credentials.
      throw new Error(`Supabase RPC ${method} returned HTTP ${response.status}. Check database schema and server key.`);
    }
    return response.json();
  }
  return {
    snapshot: owner => rpc('wt_snapshot', { p_owner: owner }),
    submit: (owner, requestId, text, name) => rpc('wt_submit', { p_owner: owner, p_request: requestId, p_text: text, p_name: name }),
    read: (owner,id) => rpc('wt_read', { p_owner: owner, p_wish: id }),
  };
}

function createStore(env = process.env) {
  const url = env.SUPABASE_URL, key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return supabaseStore(url, key);
  if (env.RENDER === 'true' || env.WISH_REQUIRE_DB === '1' || url || key) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in the server environment.');
  if (env.WISH_SHARED === '1') return fileStore(env.WISH_FILE || path.join(__dirname, '.data', 'wishes.json'));
  return null;
}

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
async function readBody(req) {
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new Error('bad');
  let n = 0; const chunks = [];
  for await (const chunk of req) { n += chunk.length; if (n > 4096) throw new Error('bad'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function ownerFor(req,res,secure) {
  const m = /(?:^|;\s*)wishing_tree_id=([0-9a-f]{64})(?:;|$)/i.exec(req.headers.cookie || '');
  const token = m ? m[1] : crypto.randomBytes(32).toString('hex');
  if (!m) res.setHeader('Set-Cookie', `wishing_tree_id=${token}; Path=/api; Max-Age=31536000; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`);
  return crypto.createHash('sha256').update(token).digest('hex');
}
function clean(value,max) {
  if (typeof value !== 'string') return null;
  const result = value.normalize('NFC').trim();
  return Array.from(result).length <= max && !/[\u0000-\u001f\u007f]/u.test(result) ? result : null;
}
function permitted(text) {
  const compact = text.replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248)).replace(/[\s　.。·,-]/gu,'');
  return !/\d{5,}/u.test(compact) && !/https?:|www\.|:\/\/|[a-z0-9-]{2,}\.(com|cn|net|org|io|me|co|app|xyz|top|cc|tv|ly|gg|ru|info|site|shop|vip)\b/i.test(text);
}
function createWishApi(store, secure = false) {
  const attempts = new Map();
  function limited(key, max) {
    const now=Date.now();
    if (attempts.size>1000) for(const [k,v] of attempts) if(now>v.until) attempts.delete(k);
    let v=attempts.get(key); if(!v||now>v.until) {v={count:0,until:now+60000};attempts.set(key,v);}
    return ++v.count>max;
  }
  return async function handle(req,res,url) {
    const endpoint=url.pathname;
    if(endpoint==='/health') { json(res,200,{ok:true,shared:!!store});return true; }
    if(!endpoint.startsWith('/api/wishes'))return false;
    if(endpoint!=='/api/wishes'&&endpoint!=='/api/wishes/read'){json(res,404,{ok:false});return true;}
    if(!store){json(res,200,{mode:'local'});return true;}
    // The API is deliberately same-origin, with a server-created anonymous browser cookie.
    if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin).host;}catch{}if(origin!==req.headers.host){json(res,403,{ok:false,reason:'bad'});return true;}}
    const owner=ownerFor(req,res,secure);
    try {
      if(req.method==='GET'&&endpoint==='/api/wishes') {
        if(limited('get:'+owner,60)){json(res,429,{ok:false,reason:'busy'});return true;}
        json(res,200,await store.snapshot(owner));return true;
      }
      if(req.method!=='POST'){json(res,405,{ok:false});return true;}
      if(limited('post:'+owner,20)||limited('global:write',240)){json(res,429,{ok:false,reason:'busy'});return true;}
      let body;try{body=await readBody(req);}catch{json(res,400,{ok:false,reason:'bad'});return true;}
      if(endpoint==='/api/wishes/read'){
        if(typeof body?.id!=='string'||!uuid.test(body.id)){json(res,400,{ok:false,reason:'bad'});return true;}
        json(res,200,await store.read(owner,body.id));return true;
      }
      const text=clean(body?.text,160),name=clean(body?.name??'',16),requestId=body?.requestId;
      if(!text||name===null||!permitted(text)||!permitted(name)||typeof requestId!=='string'||!uuid.test(requestId)){json(res,400,{ok:false,reason:'bad'});return true;}
      const result=await store.submit(owner,requestId,text,name);
      json(res,result.ok?200:429,result);return true;
    } catch(error) {
      console.error('Wish database operation failed:',error.message);
      if(!res.headersSent)json(res,503,{ok:false,reason:'storage',mode:'shared'});return true;
    }
  };
}
module.exports = {createStore,createWishApi,fileStore,supabaseStore};
