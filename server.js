const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(100) NOT NULL,
      title VARCHAR(255),
      body TEXT,
      color VARCHAR(50),
      date TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ Database ready!');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'shifat-notes-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

function requireLogin(req, res, next) {
  if (req.session.userId) return next();
  res.status(401).json({ error: 'Login করো' });
}

app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.json({ error: 'সব তথ্য দাও' });
    const existing = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
    if (existing.rows.length > 0)
      return res.json({ error: 'এই নাম আগেই নেওয়া হয়েছে' });
    const hash = bcrypt.hashSync(password, 10);
    await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hash]);
    req.session.userId = username;
    req.session.username = username;
    res.json({ success: true });
  } catch(err) {
    res.json({ error: 'সমস্যা: ' + err.message });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
    if (result.rows.length === 0)
      return res.json({ error: 'ব্যবহারকারী পাওয়া যায়নি' });
    const user = result.rows[0];
    if (!bcrypt.compareSync(password, user.password))
      return res.json({ error: 'পাসওয়ার্ড ভুল' });
    req.session.userId = username;
    req.session.username = username;
    res.json({ success: true });
  } catch(err) {
    res.json({ error: 'সমস্যা: ' + err.message });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/notes', requireLogin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notes WHERE user_id=$1 ORDER BY date DESC',
      [req.session.userId]
    );
    res.json(result.rows.map(n => ({
      _id: n.id.toString(),
      title: n.title,
      body: n.body,
      color: n.color,
      date: n.date
    })));
  } catch(err) {
    res.json([]);
  }
});

app.post('/api/notes', requireLogin, async (req, res) => {
  try {
    const { title, body, color } = req.body;
    const result = await pool.query(
      'INSERT INTO notes (user_id, title, body, color) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.session.userId, title, body, color]
    );
    const n = result.rows[0];
    res.json({ _id: n.id.toString(), title: n.title, body: n.body, color: n.color, date: n.date });
  } catch(err) {
    res.json({ error: err.message });
  }
});

app.put('/api/notes/:id', requireLogin, async (req, res) => {
  try {
    const { title, body, color } = req.body;
    await pool.query(
      'UPDATE notes SET title=$1, body=$2, color=$3 WHERE id=$4 AND user_id=$5',
      [title, body, color, req.params.id, req.session.userId]
    );
    res.json({ success: true });
  } catch(err) {
    res.json({ error: err.message });
  }
});

app.delete('/api/notes/:id', requireLogin, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM notes WHERE id=$1 AND user_id=$2',
      [req.params.id, req.session.userId]
    );
    res.json({ success: true });
  } catch(err) {
    res.json({ error: err.message });
  }
});

app.get('/api/me', (req, res) => {
  if (req.session.userId)
    res.json({ loggedIn: true, username: req.session.username });
  else
    res.json({ loggedIn: false });
});

const PORT = process.env.PORT || 3000;
initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
});