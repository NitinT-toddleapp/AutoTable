const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 4000;
const clientDist = path.resolve(__dirname, '../client/dist');

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'timetable-server' });
});

app.use(express.static(clientDist));

app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) {
      res.status(503).send('Client build not found. Run `npm run build` first.');
    }
  });
});

app.listen(port, () => {
  console.log(`Static server running on http://localhost:${port}`);
});
