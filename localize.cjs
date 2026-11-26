// Local localization patch for the supplied cayuocnguyen.zip.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dir = __dirname;
const read = name => fs.readFileSync(path.join(dir, name), 'utf8');
const write = (name, data) => fs.writeFileSync(path.join(dir, name), data, 'utf8');
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const originalApp = '22f346ad13e14f505d463e8b106895f0b4217dc68616b02714dbd165bfc83479';
const originalHtml = 'b34c668917defb0a909f50e72940b22a1b74b88d6001cd4b180650d7cd3fa376';
const marker = '/* Wishing Tree EN/VI localization v1 */';
if (!['app.js', 'index.html'].every(name => fs.existsSync(path.join(dir, name)))) {
  console.error('Original game files are missing. Run dev.bat to locate cayuocnguyen.zip.');
  process.exit(1);
}
let app = read('app.js');
let html = read('index.html');
if (app.startsWith(marker) && html.includes('<!-- Wishing Tree EN/VI localization v1 -->')) {
  console.log('EN/VI localization already installed.');
  process.exit(0);
}
if (digest(app) !== originalApp || digest(html) !== originalHtml) {
  throw new Error('Expected the original app.js and index.html from cayuocnguyen.zip. Extract the original ZIP into this folder first.');
}
const translations = JSON.parse(read('vi.json'));
// Replace complete Unicode escape runs, preserving surrounding template expressions and code.
app = app.replace(/(?:\\u[\da-fA-F]{4})+/g, chunk => {
  if (!Object.hasOwn(translations, chunk)) return chunk;
  return JSON.stringify(translations[chunk]).slice(1, -1);
});
// Keep the existing engine's identifiers intact; change the locale values and keys only.
app = app.replace(/"zh"/g, '"vi"').replace(/\bzh:/g, 'vi:').replace(/\.zh\b/g, '.vi');
app = app.replace('let e="vi";try{e=localStorage.getItem("kanshu-lang")||((navigator.language||"vi").toLowerCase().startsWith("vi")?"vi":"en")}catch{}',
  'let e="vi";try{e=localStorage.getItem("wishing-tree-lang")==="en"?"en":"vi"}catch{}');
app = app.replaceAll('"kanshu-lang"', '"wishing-tree-lang"');
app = app.replaceAll('lang:"EN"', 'lang:"English"');
app = app.replaceAll('Treegazing', 'Wishing Tree');
// Preserve the original engine attribution in the header.
app = app.replace('/* 看树 Wishing Tree.', '/* Treegazing (original).');
// Use a Latin-script date and print layout for Vietnamese postcards.
app = app.replace(/ZI=\(n,t\)=>\{let e=new Date\(n\);return t==="vi"\?[\s\S]*?\},Rb=/,
  'ZI=(n,t)=>{let e=new Date(n);return t==="vi"?e.toLocaleDateString("vi-VN"):`${e.getDate()} ${$I[e.getMonth()]} ${e.getFullYear()}`},Rb=');
app = app.replace('e==="vi"?\'<text x="31"', 'false?\'<text x="31"');
app = app.replace('s==="vi"?`<text x="18"', 'false?`<text x="18"');
app = app.replace('t==="vi"?\'<text x="204"', 'false?\'<text x="204"');
app = app.replace('>TREEGAZING</text>', '>WISHING TREE</text>');
app = app.replace('i.sat(o)+(t==="vi"?"":" ")+i.with', 'i.sat(o)+" "+i.with');
app = app.replace('w=b=>t==="vi"?b.split("\\u3002").filter(Boolean).map(_=>`<span>${hn(_)}\\u3002</span>`).join(""):`<span>${hn(b)}</span>`', 'w=b=>`<span>${hn(b)}</span>`');
app = app.replace('r==="vi"?"":" "', '" "');
app = app.replace('/触屏|touch/', '/cảm ứng|touch/');
app = app.replaceAll('Noto Serif SC', 'Georgia');
app = app.replaceAll('Cormorant Garamond', 'Georgia');
app = app.replaceAll('TA  ấy', 'người ấy').replaceAll('cạnh  người', 'cạnh người').replaceAll('cho  người', 'cho người');
app = app.replaceAll('Mở  {url}', 'Mở {url}').replaceAll('máy tính  {url}', 'máy tính {url}');
app = app.replaceAll('có  ${', 'có ${').replaceAll('đủ  ${', 'đủ ${').replaceAll('còn  ${', 'còn ${');
app = app.replace('Chỉ ghi lại số liệu ẩn danh về lượt ghé, thời gian và tính năng sử dụng.', 'Bản thử nghiệm lưu dữ liệu chơi trên trình duyệt này.');
app = app.replace('link này cho', 'liên kết này cho');
// The supplied archive has no sculpt worker; use the engine's existing main-thread fallback.
app = app.replace('sc,jg=!1,qA=0', 'sc,jg=!0,qA=0');
// Available English speech clips live in voices/, and other lines use the built-in sound fallback.
app = app.replace(/Db=n=>\{let t=po\.speak\.includes[\s\S]*?\},Pb=\{\}/,
  'Db=n=>/^(ask|got)[1-4]$/.test(n.id)?[`voices/en-${n.id}.mp3`]:[],Pb={}');
// Disable original telemetry on the local-only copy.
app = app.replace(/function aR\(\)\{[\s\S]*?\}function lR\(\)/, 'function aR(){return true}function lR()');
// Make English/Vietnamese fallback consistent even if an earlier locale was stored.
if (!app.includes('localStorage.getItem("wishing-tree-lang")==="en"?"en":"vi"')) throw new Error('Locale initialization patch did not apply.');
// Preserve backups and operate on the two supplied source files only.
html = html.replace(/<script>try\{document\.documentElement\.lang=.*?<\/script>/,
  '<script>try{document.documentElement.lang=localStorage.getItem("wishing-tree-lang")==="en"?"en":"vi"}catch(e){document.documentElement.lang="vi"}</script>');
html = html.replace('<html lang="en">', '<html lang="vi">');
html = html.replace(/<link rel="icon"[^>]+>/, '<link rel="icon" type="image/png" href="tree.png">');
html = html.replace('<title>Treegazing</title>', '<title>Cây ước nguyện</title>');
html = html.replaceAll('Treegazing', 'Cây ước nguyện');
html = html.replace('content="zh_CN"', 'content="vi_VN"');
html = html.replace(/<meta property="og:(?:url|image(?::[^\"]+)?)"[^>]*>\s*/g, '');
html = html.replace(/<link rel="preconnect"[^>]*>\s*|<link href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/g, '');
html = html.replace(/<script>if\(document\.documentElement\.lang==='zh'\).*?<\/script>/, '');
html = html.replace('<!-- Mirrored from', '<!-- Wishing Tree EN/VI localization v1 -->\n<!-- Mirrored from');
html = html.replaceAll('html[lang="en"]', 'html:is([lang="en"], [lang="vi"])');
html = html.replaceAll('.pc.en', '.pc:is(.en,.vi)');
html = html.replaceAll('"Noto Serif SC", "Songti SC", "STSong", "Source Han Serif SC", serif', 'Georgia, "Times New Roman", serif');
html = html.replaceAll('"Caveat", "Ma Shan Zheng", "Kaiti SC", "STKaiti", "KaiTi", "Bradley Hand", cursive', '"Segoe Print", Georgia, serif');
html = html.replaceAll('"Ma Shan Zheng", "Kaiti SC", "STKaiti", "KaiTi", serif', '"Segoe Print", Georgia, serif');
html = html.replaceAll('"Cormorant Garamond"', 'Georgia').replaceAll('"Caveat"', '"Segoe Print"');
html = html.replace('</head>', '<style>html[lang="vi"] #title{letter-spacing:.015em;font-size:clamp(38px,5.6vw,78px)} #title{overflow-wrap:normal} #intro h1::before{content:"";display:block;width:clamp(48px,6vw,76px);height:clamp(48px,6vw,76px);margin-bottom:12px;background:url(tree.png) center/contain no-repeat} html[lang="vi"] #wishText{font-size:27px}</style>\n</head>');
// The title is immediately in the chosen language, before the 3D bundle initializes.
html = html.replace('<h1 id="title">Cây ước nguyện</h1>', '<h1 id="title">Cây ước nguyện</h1><script>if(document.documentElement.lang==="en")document.getElementById("title").textContent="Wishing Tree"</script>');
fs.copyFileSync(path.join(dir, 'app.js'), path.join(dir, 'app.js.original'));
fs.copyFileSync(path.join(dir, 'index.html'), path.join(dir, 'index.html.original'));
write('app.js', marker + '\n' + app);
write('index.html', html);
console.log('Installed Cây ước nguyện / Wishing Tree localization.');
