const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3001;

// データベースファイルのパス
const dbFilePath = path.join(__dirname, '../database/lock-checker.db');

// ログファイルのパス
const logFilePath = path.join(__dirname, '../database/lock-history.log');

app.use(bodyParser.json());
app.use(cors());

const db = new sqlite3.Database(dbFilePath);

db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS lock_status (id INTEGER PRIMARY KEY, status TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS lock_history (id INTEGER PRIMARY KEY, status TEXT, "UTC_TIMESTAMP" TEXT, "JST_TIMESTAMP" TEXT)');
  db.get('SELECT COUNT(*) AS count FROM lock_status', (err, row) => {
    if (err) {
      console.error('Error checking lock_status table:', err.message);
      return;
    }
    if (row.count === 0) {
      db.run('INSERT INTO lock_status (status) VALUES ("False")');
    }
  });
});

function getJSTTimestamp() {
  const now = new Date();
  const jstOffset = 9 * 60; // JSTはUTC+9時間
  const jstTime = new Date(now.getTime() + jstOffset * 60 * 1000);
  return jstTime.toISOString();
}

app.get('/status', (req, res) => {
  db.get('SELECT status FROM lock_status WHERE id = 1', (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ status: row.status === 'True' });
  });
});

app.post('/status', (req, res) => {
  const { status } = req.body;
  const statusText = status ? 'True' : 'False';
  const timestampUTC = new Date().toISOString(); // UTCタイムスタンプを取得
  const timestampJST = getJSTTimestamp(); // JSTタイムスタンプを取得

  db.run('UPDATE lock_status SET status = ? WHERE id = 1', [statusText], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    db.run('INSERT INTO lock_history (status, "UTC_TIMESTAMP", "JST_TIMESTAMP") VALUES (?, ?, ?)', [statusText, timestampUTC, timestampJST], (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      // ログファイルに追記
      const logEntry = `${timestampUTC} (JST: ${timestampJST}) - ${statusText === 'True' ? 'Locked' : 'Unlocked'}\n`;
      fs.appendFile(logFilePath, logEntry, (err) => {
        if (err) {
          console.error('Error writing to log file:', err.message);
        }
      });
      res.json({ message: 'Status updated' });
    });
  });
});

app.get('/history', (req, res) => {
  db.all('SELECT status, "JST_TIMESTAMP" FROM lock_history ORDER BY id DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ history: rows });
  });
});

app.delete('/history', (req, res) => {
  db.run('DELETE FROM lock_history', (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'History cleared' });
  });
});

app.get('/history/:date', (req, res) => {
  const date = req.params.date;
  const startDate = new Date(`${date}T00:00:00.000Z`).toISOString(); // 日付をISO 8601形式のUTCに変換
  const endDate = new Date(new Date(startDate).setDate(new Date(startDate).getDate() + 1)).toISOString();
  
  db.all('SELECT status, "JST_TIMESTAMP" FROM lock_history WHERE "UTC_TIMESTAMP" >= ? AND "UTC_TIMESTAMP" < ? ORDER BY id DESC', [startDate, endDate], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ history: rows });
  });
});

app.get('/log', (req, res) => {
  fs.readFile(logFilePath, 'utf8', (err, data) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ log: data.split('\n').filter(line => line.length > 0) });
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
