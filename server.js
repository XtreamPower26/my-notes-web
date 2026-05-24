const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Datastore = require('nedb');
const path = require('path');

const app = express();
const users = new Datastore({ filename: 'users.db', autoload: true });
const notes = new Datastore({ filename: 'notes.db', autoload: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'notenest-secret-2024',
  resave: false,
  saveUninitialized: false
}));

function requireLogin(req, res, next) {
  if (req.session.userId) return next();
  res.redirect('/');
}

// Register
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.json({ error: 'সব তথ্য দাও' });

  users.findOne({ username }, (err, user) => {
    if (user) return res.json({ error: 'এই নাম আগেই নেওয়া হয়েছে' });
    const hash = bcrypt.hashSync(password, 10);
    users.insert({ username, password: hash }, (err, newUser) => {
      req.session.userId = newUser._id;
      req.session.username = newUser.username;
      res.json({ success: true });
    });
  });
});

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  users.findOne({ username }, (err, user) => {
    if (!user) return res.json({ error: 'ব্যবহারকারী পাওয়া যায়নি' });
    if (!bcrypt.compareSync(password, user.password))
      return res.json({ error: 'পাসওয়ার্ড ভুল' });
    req.session.userId = user._id;
    req.session.username = user.username;
    res.json({ success: true });
  });
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get notes
app.get('/api/notes', requireLogin, (req, res) => {
  notes.find({ userId: req.session.userId }).sort({ date: -1 }).exec((err, docs) => {
    res.json(docs);
  });
});

// Create note
app.post('/api/notes', requireLogin, (req, res) => {
  const { title, body, color } = req.body;
  notes.insert({
    userId: req.session.userId,
    title, body, color,
    date: new Date().toISOString()
  }, (err, doc) => res.json(doc));
});

// Update note
app.put('/api/notes/:id', requireLogin, (req, res) => {
  const { title, body, color } = req.body;
  notes.update(
    { _id: req.params.id, userId: req.session.userId },
    { $set: { title, body, color } },
    {},
    (err) => res.json({ success: true })
  );
});

// Delete note
app.delete('/api/notes/:id', requireLogin, (req, res) => {
  notes.remove({ _id: req.params.id, userId: req.session.userId }, {}, () => {
    res.json({ success: true });
  });
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