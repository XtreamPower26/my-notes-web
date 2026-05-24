const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();

const MONGO_URL = process.env.MONGO_URL || '';

let db, users, notes;

async function connectDB() {
  try {
    const client = new MongoClient(MONGO_URL, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    await client.connect();
    db = client.db('shifatdb');
    users = db.collection('users');
    notes = db.collection('notes');
    console.log('✅ MongoDB connected!');
  } catch(err) {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  }
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
    const existing = await users.findOne({ username });
    if (existing)
      return res.json({ error: 'এই নাম আগেই নেওয়া হয়েছে' });
    const hash = bcrypt.hashSync(password, 10);
    await users.insertOne({ username, password: hash });
    req.session.userId = username;
    req.session.username = username;
    res.json({ success: true });
  } catch(err) {
    console.error(err);
    res.json({ error: 'সার্ভার সমস্যা: ' + err.message });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await users.findOne({ username });
    if (!user)
      return res.json({ error: 'ব্যবহারকারী পাওয়া যায়নি' });
    if (!bcrypt.compareSync(password, user.password))
      return res.json({ error: 'পাসওয়ার্ড ভুল' });
    req.session.userId = username;
    req.session.username = username;
    res.json({ success: true });
  } catch(err) {
    res.json({ error: 'সার্ভার সমস্যা: ' + err.message });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/notes', requireLogin, async (req, res) => {
  try {
    const userNotes = await notes.find({ userId: req.session.userId }).sort({ date: -1 }).toArray();
    res.json(userNotes);
  } catch(err) {
    res.json([]);
  }
});

app.post('/api/notes', requireLogin, async (req, res) => {
  try {
    const { title, body, color } = req.body;
    const note = {
      userId: req.session.userId,
      title, body, color,
      date: new Date().toISOString()
    };
    const result = await notes.insertOne(note);
    res.json({ ...note, _id: result.insertedId });
  } catch(err) {
    res.json({ error: err.message });
  }
});

app.put('/api/notes/:id', requireLogin, async (req, res) => {
  try {
    const { title, body, color } = req.body;
    await notes.updateOne(
      { _id: new ObjectId(req.params.id), userId: req.session.userId },
      { $set: { title, body, color } }
    );
    res.json({ success: true });
  } catch(err) {
    res.json({ error: err.message });
  }
});

app.delete('/api/notes/:id', requireLogin, async (req, res) => {
  try {
    await notes.deleteOne({
      _id: new ObjectId(req.params.id),
      userId: req.session.userId
    });
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
connectDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
});