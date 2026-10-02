-- Родопска ферма — онлайн база (Cloudflare D1).
-- Пускане: npx wrangler d1 execute rodopska-ferma --remote --file server/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                 -- както го е написал играчът
  name_key TEXT NOT NULL UNIQUE,      -- с малки букви (за търсене и уникалност)
  pass TEXT NOT NULL,                 -- PBKDF2-SHA256 (base64)
  salt TEXT NOT NULL,
  created INTEGER NOT NULL,
  seen INTEGER NOT NULL,
  farm TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  earned INTEGER NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  week TEXT NOT NULL DEFAULT '',
  week_earned INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  rev INTEGER NOT NULL DEFAULT 0,     -- версия на записа в облака
  saved INTEGER NOT NULL DEFAULT 0,   -- кога е играно последно (S.last)
  save TEXT
);
CREATE INDEX IF NOT EXISTS users_level ON users(level DESC, xp DESC);
CREATE INDEX IF NOT EXISTS users_earned ON users(earned DESC);
CREATE INDEX IF NOT EXISTS users_week ON users(week, week_earned DESC);
CREATE INDEX IF NOT EXISTS users_likes ON users(likes DESC);
CREATE INDEX IF NOT EXISTS users_seen ON users(seen DESC);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,             -- SHA-256 на истинския ключ
  user INTEGER NOT NULL,
  created INTEGER NOT NULL,
  seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user);

CREATE TABLE IF NOT EXISTS friends (
  user INTEGER NOT NULL,
  friend INTEGER NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY (user, friend)
);
CREATE INDEX IF NOT EXISTS friends_friend ON friends(friend);

CREATE TABLE IF NOT EXISTS helps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  helper INTEGER NOT NULL,
  owner INTEGER NOT NULL,
  uid INTEGER NOT NULL,
  kind TEXT NOT NULL,                 -- field | animal | tree
  day TEXT NOT NULL,
  created INTEGER NOT NULL,
  done INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS helps_owner ON helps(owner, done);
CREATE INDEX IF NOT EXISTS helps_day ON helps(helper, day);

CREATE TABLE IF NOT EXISTS likes (
  liker INTEGER NOT NULL,
  owner INTEGER NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY (liker, owner, day)
);

CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller INTEGER NOT NULL,
  item TEXT NOT NULL,
  qty INTEGER NOT NULL,
  price INTEGER NOT NULL,
  created INTEGER NOT NULL,
  buyer INTEGER,
  sold INTEGER,
  collected INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS listings_open ON listings(buyer, created DESC);
CREATE INDEX IF NOT EXISTS listings_seller ON listings(seller, collected);

CREATE TABLE IF NOT EXISTS limits (
  key TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  until INTEGER NOT NULL
);
