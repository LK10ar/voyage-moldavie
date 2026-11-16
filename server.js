const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
const TOKEN = process.env.APP_TOKEN; // optionnel : code d'accès
let col;

app.use(express.json({ limit: '2mb' }));
app.use('/api', (q, r, n) =>
  TOKEN && q.get('x-token') !== TOKEN ? r.status(401).json({ error: 'token' }) : n());

// Synchro : le client envoie tout, le plus récent (updatedAt) gagne, on renvoie tout.
app.post('/api/sync', async (q, r) => {
  try {
    const inc = (Array.isArray(q.body.items) ? q.body.items : []).filter(i => i && i.id);
    const ex = new Map((await col.find({ _id: { $in: inc.map(i => i.id) } },
      { projection: { updatedAt: 1 } }).toArray()).map(d => [d._id, d.updatedAt]));
    const ops = inc.filter(i => !(ex.get(i.id) >= i.updatedAt)).map(i => ({
      replaceOne: { filter: { _id: i.id }, replacement: { ...i, _id: i.id }, upsert: true } }));
    if (ops.length) await col.bulkWrite(ops);
    r.json({ items: (await col.find().toArray()).map(({ _id, ...d }) => d) });
  } catch (e) { console.error(e); r.status(500).json({ error: 'server' }); }
});

app.use(express.static('public'));

MongoClient.connect(process.env.MONGODB_URI).then(c => {
  col = c.db(process.env.DB_NAME || 'voyage').collection('items');
  app.listen(process.env.PORT || 3000, () => console.log('OK'));
}).catch(e => { console.error(e); process.exit(1); });
