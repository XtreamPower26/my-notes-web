const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();

const USERS_FILE = path.join('/tmp', 'users.json');
const NOTES_FILE = path.join('/tmp', 'notes.json');

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return {}; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'shifat-notes-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

function requireLogin(req, res, next) {
  if (req.session.userId) return next();
  res.status(401).json({ error: 'Login করো' });
}

// Register
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.json({ error: 'সব তথ্য দাও' });
  const users = readJSON(USERS_FILE);
  if (users[username])
    return res.json({ error: 'এই নাম আগেই নেওয়া হয়েছে' });
  users[username] = { username, password: bcrypt.hashSync(password, 10) };
  writeJSON(USERS_FILE, users);
  const notes = readJSON(NOTES_FILE);
  notes[username] = [];
  writeJSON(NOTES_FILE, notes);
  req.session.userId = username;
  req.session.username = username;
  res.json({ success: true });
});

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users[username];
  if (!user) return res.json({ error: 'ব্যবহারকারী পাওয়া যায়নি' });
  if (!bcrypt.compareSync(password, user.password))
    return res.json({ error: 'পাসওয়ার্ড ভুল' });
  req.session.userId = username;
  req.session.username = username;
  res.json({ success: true });
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get notes
app.get('/api/notes', requireLogin, (req, res) => {
  const notes = readJSON(NOTES_FILE);
  const userNotes = notes[req.session.userId] || [];
  res.json([...userNotes].reverse());
});

// Create note
app.post('/api/notes', requireLogin, (req, res) => {
  const { title, body, color } = req.body;
  const notes = readJSON(NOTES_FILE);
  if (!notes[req.session.userId]) notes[req.session.userId] = [];
  const note = {
    _id: Date.now().toString(),
    title, body, color,
    date: new Date().toISOString()
  };
  notes[req.session.userId].push(note);
  writeJSON(NOTES_FILE, notes);
  res.json(note);
});

// Update note
app.put('/api/notes/:id', requireLogin, (req, res) => {
  const { title, body, color } = req.body;
  const notes = readJSON(NOTES_FILE);
  const userNotes = notes[req.session.userId] || [];
  const idx = userNotes.findIndex(n => n._id === req.params.id);
  if (idx !== -1) userNotes[idx] = { ...userNotes[idx], title, body, color };
  notes[req.session.userId] = userNotes;
  writeJSON(NOTES_FILE, notes);
  res.json({ success: true });
});

// Delete note
app.delete('/api/notes/:id', requireLogin, (req, res) => {
  const notes = readJSON(NOTES_FILE);
  if (notes[req.session.userId]) {
    notes[req.session.userId] = notes[req.session.userId].filter(n => n._id !== req.params.id);
    writeJSON(NOTES_FILE, notes);
  }
  res.json({ success: true });
});

// Session check
app.get('/api/me', (req, res) => {
  if (req.session.userId)
    res.json({ loggedIn: true, username: req.session.username });
  else
    res.json({ loggedIn: false });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));