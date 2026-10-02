// Проверка на онлайн сървъра: node test/online.mjs [адрес]  (по подразбиране локалният wrangler dev на :8799)
const API = process.argv[2] || process.env.API || 'http://localhost:8799';
let ok = 0, bad = 0;
const check = (cond, what) => { if (cond) { ok++; console.log('  ✓', what); } else { bad++; console.log('  ✗', what); } };

async function call(method, path, token, body) {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

const suffix = Math.random().toString(36).slice(2, 7);
const A = 'Тест' + suffix, B = 'Проба' + suffix;
const save = (level, earned) => ({ v: 1, name: 'Ферма ' + level, level, xp: 10, coins: 999, diamonds: 5, inv: { wheat: 3 }, entities: [{ uid: 1, type: 'field', x: 0, z: 0, rot: 0, crop: 'wheat', planted: Date.now(), ready: Date.now() + 60000 }], stats: { earned, orders: 3 }, last: Date.now() });

console.log('Сървър:', API);
console.log('Регистрация и вход');
let r = await call('POST', '/api/register', null, { name: A, pass: 'тайна123', farm: 'Слънчевата' });
check(r.status === 200 && r.data.token, 'регистрация на A');
const tA = r.data?.token;
r = await call('POST', '/api/register', null, { name: A.toUpperCase(), pass: 'тайна123' });
check(r.status === 409, 'същото име (с главни букви) е заето');
r = await call('POST', '/api/register', null, { name: 'fuck' + suffix, pass: 'тайна123' });
check(r.status === 400, 'грубо име се отказва');
r = await call('POST', '/api/register', null, { name: 'ab', pass: 'тайна123' });
check(r.status === 400, 'твърде кратко име');
r = await call('POST', '/api/register', null, { name: B, pass: '123' });
check(r.status === 400, 'твърде кратка парола');
r = await call('POST', '/api/register', null, { name: B, pass: 'парола42' });
const tB = r.data?.token;
check(!!tB, 'регистрация на B');
r = await call('POST', '/api/login', null, { name: A.toLowerCase(), pass: 'грешна' });
check(r.status === 401, 'грешна парола');
r = await call('POST', '/api/login', null, { name: A.toLowerCase(), pass: 'тайна123' });
check(r.status === 200 && r.data.token && r.data.me.name === A, 'вход с малки букви');
r = await call('GET', '/api/me', 'f'.repeat(64));
check(r.status === 401, 'чужд ключ не става');

console.log('Запис в облака');
r = await call('PUT', '/api/save', tA, { save: save(7, 1000), rev: 0 });
check(r.status === 200 && r.data.rev === 1, 'първи запис (rev 1)');
r = await call('PUT', '/api/save', tA, { save: save(8, 1500), rev: 0 });
check(r.status === 409 && r.data.rev === 1, 'стар запис → 409 (друго устройство)');
r = await call('PUT', '/api/save', tA, { save: save(8, 1500), rev: 1 });
check(r.status === 200 && r.data.rev === 2, 'втори запис (rev 2)');
r = await call('GET', '/api/save', tA);
check(r.data.save?.level === 8 && r.data.rev === 2, 'четене на записа');
r = await call('PUT', '/api/save', tB, { save: save(3, 200), rev: 0 });
check(r.status === 200, 'запис на B');
r = await call('PUT', '/api/save', tA, { save: { v: 2 }, rev: 2 });
check(r.status === 400, 'грешен запис се отказва');

console.log('Приятели и гостуване');
r = await call('POST', '/api/friends', tA, { name: B });
check(r.status === 200 && r.data.friend.name === B, 'A добавя B');
r = await call('POST', '/api/friends', tA, { name: A });
check(r.status === 400, 'не можеш да добавиш себе си');
r = await call('GET', '/api/friends', tA);
check(r.data.rows?.length === 1 && r.data.rows[0].helpsLeft === 5, 'списък с приятели (5 помощи)');
r = await call('GET', '/api/friends', tB);
check(r.data.fans?.some((f) => f.name === A), 'B вижда, че A го е добавил');
r = await call('GET', '/api/farm/' + encodeURIComponent(B), tA);
check(r.status === 200 && Array.isArray(r.data.save.entities) && !r.data.save.coins && Object.keys(r.data.save.inv).length === 0, 'фермата на B — без пари и склад');
r = await call('GET', '/api/players?q=' + encodeURIComponent(B.slice(0, 4).toLowerCase()), tA);
check(r.data.rows?.some((p) => p.name === B), 'търсене на играч');

console.log('Помощ и харесване');
r = await call('POST', '/api/help', tA, { to: B, uid: 1, kind: 'field' });
check(r.status === 200 && r.data.helpsLeft === 4, 'A полива нива на B');
r = await call('POST', '/api/help', tA, { to: B, uid: 1, kind: 'field' });
check(r.status === 400, 'същата нива втори път — не');
for (let i = 2; i <= 5; i++) await call('POST', '/api/help', tA, { to: B, uid: i, kind: 'animal' });
r = await call('POST', '/api/help', tA, { to: B, uid: 9, kind: 'tree' });
check(r.status === 429, 'шестата помощ за деня — не');
r = await call('POST', '/api/like', tA, { to: B });
check(r.status === 200 && r.data.likes === 1, 'A харесва фермата на B');
r = await call('POST', '/api/like', tA, { to: B });
check(r.data.likes === 1, 'второ харесване в същия ден не се брои');
r = await call('GET', '/api/inbox', tB);
check(r.data.helps?.length === 5 && r.data.helps[0].name === A, 'B вижда 5 помощи от A');
await call('POST', '/api/inbox/ack', tB, { helps: r.data.helps.map((h) => h.id) });
r = await call('GET', '/api/inbox', tB);
check(r.data.helps?.length === 0, 'след потвърждение — празно');

console.log('Класации');
r = await call('GET', '/api/top?by=level', tB);
check(r.status === 200 && r.data.rows.length >= 2 && r.data.me.rank >= 1, 'по ниво');
r = await call('GET', '/api/top?by=week', tA);
check(r.status === 200 && r.data.me.value === 1500, 'седмицата (A спечели 1500)');
r = await call('GET', '/api/top?by=likes', tB);
check(r.data.rows.some((x) => x.name === B && x.value >= 1), 'по харесвания');

console.log('Пазар');
r = await call('POST', '/api/market', tA, { item: 'cheese', qty: 2, price: 999999 });
check(r.status === 400, 'твърде висока цена се отказва');
r = await call('POST', '/api/market', tA, { item: 'feed_cow', qty: 1, price: 5 });
check(r.status === 400, 'фураж не се продава');
r = await call('POST', '/api/market', tA, { item: 'cheese', qty: 2, price: 150 });
const lid = r.data?.id;
check(r.status === 200 && lid, 'A обявява 2 сирена за 150');
r = await call('POST', '/api/market', tA, { item: 'bread', qty: 1, price: 30 });
const lid2 = r.data?.id;
r = await call('GET', '/api/market', tB);
check(r.data.rows?.some((x) => x.id === lid && x.seller === A && x.friend === 0), 'B вижда обявата');
r = await call('POST', `/api/market/${lid}/buy`, tA);
check(r.status === 409, 'не можеш да купиш своето');
r = await call('POST', `/api/market/${lid}/buy`, tB);
check(r.status === 200 && r.data.item === 'cheese' && r.data.qty === 2 && r.data.price === 150, 'B купува');
r = await call('POST', `/api/market/${lid}/buy`, tB);
check(r.status === 409, 'вече е купено');
r = await call('GET', '/api/inbox', tA);
check(r.data.sold?.some((s) => s.id === lid && s.buyer === B), 'A вижда, че е продадено на B');
r = await call('POST', `/api/market/${lid}/collect`, tA);
check(r.status === 200 && r.data.price === 150, 'A взима 150 монети');
r = await call('POST', `/api/market/${lid}/collect`, tA);
check(r.status === 409, 'втори път не може');
r = await call('DELETE', `/api/market/${lid2}`, tA);
check(r.status === 200 && r.data.item === 'bread', 'A маха непродадената обява (хлябът се връща)');

console.log('Изтриване');
r = await call('DELETE', '/api/account', tB, { pass: 'грешна' });
check(r.status === 401, 'грешна парола — не трие');
r = await call('DELETE', '/api/account', tB, { pass: 'парола42' });
check(r.status === 200, 'B изтрива профила си');
r = await call('GET', '/api/me', tB);
check(r.status === 401, 'ключът на B вече не важи');
r = await call('DELETE', '/api/account', tA, { pass: 'тайна123' });
check(r.status === 200, 'A изтрива профила си (почистване)');

console.log(`\n${ok} успешни, ${bad} грешни`);
process.exit(bad ? 1 : 0);
