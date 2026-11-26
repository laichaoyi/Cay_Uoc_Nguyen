/* Single-origin shared wishes; retains the previous browser-only mode on localhost. */
(function(root){
  function createWishClient(local, fetchImpl = root.fetch.bind(root)) {
    let mode = 'checking', records = [], left = 3, revision = 0, pending = false, lastAttempt = null;
    let refreshPromise = null;
    function apply(result) {
      if (result.mode === 'local') { mode = 'local'; return; }
      if (result.mode === 'shared') {
        mode = 'shared';
        if(Array.isArray(result.records)) records = result.records;
        if(Number.isInteger(result.left)) left = result.left;
      }
    }
    async function request(url,body) {
      const options = {cache:'no-store', credentials:'same-origin', signal:AbortSignal.timeout(20000)};
      if(body!==undefined)Object.assign(options,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const response=await fetchImpl(url,options);
      return response.json();
    }
    const client={
      get mode(){return mode;}, get ready(){return mode!=='checking';}, key:local.key,
      list(){return mode==='local'?local.list():records;},
      left(){return mode==='local'?local.left():left;},
      refresh(){
        if(mode==='local'||pending)return Promise.resolve();
        if(refreshPromise)return refreshPromise;
        const version=revision;
        refreshPromise=request('/api/wishes').then(result=>{if(version===revision)apply(result);}).catch(()=>{}).finally(()=>{refreshPromise=null;});
        return refreshPromise;
      },
      async submit(text,name){
        if(mode==='local')return local.submit(text,name);
        if(mode!=='shared'||pending)return {ok:false,reason:'storage'};
        pending=true;revision++;
        const signature=JSON.stringify([text,name]);
        if(lastAttempt?.signature!==signature)lastAttempt={signature,id:root.crypto.randomUUID()};
        try{
          const result=await request('/api/wishes',{text,name,requestId:lastAttempt.id});
          apply(result);
          if(result.ok||result.reason==='today'||result.reason==='bad')lastAttempt=null;
          return result;
        }catch{return {ok:false,reason:'storage'};}
        finally{pending=false;revision++;}
      },
      async read(id){
        if(mode!=='shared')return;
        try{await request('/api/wishes/read',{id});}catch{}
      }
    };
    return client;
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={createWishClient};
  else root.WishingTreeWishes=createWishClient(root.WishingTreeLocalWishes);
})(globalThis);
