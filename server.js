const path = require("path");
const crypto = require("crypto");
const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const UPSTASH_REST_URL = process.env.UPSTASH_REST_URL;
const UPSTASH_REST_TOKEN = process.env.UPSTASH_REST_TOKEN;
const HAS_UPSTASH_CONFIG = Boolean(UPSTASH_REST_URL && UPSTASH_REST_TOKEN);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

function sessionKey(token) {
  return `session:${token}`;
}

function userKey(username) {
  return `user:${username}`;
}

function connectionsKey(username) {
  return `connections:${username}`;
}

function selectedThreadKey(username) {
  return `selected:${username}`;
}

async function redisPipeline(commands) {
  if (!HAS_UPSTASH_CONFIG) {
    throw new Error("Upstash configuration missing");
  }

  const response = await fetch(`${UPSTASH_REST_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upstash request failed: ${text}`);
  }

  const payload = await response.json();
  return payload.map((entry) => {
    if (entry.error) {
      throw new Error(entry.error);
    }
    return entry.result ?? null;
  });
}

async function redisCommand(command) {
  const [result] = await redisPipeline([command]);
  return result;
}

function normalizeUsername(username = "") {
  return username.trim().toLowerCase();
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function getUser(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  const raw = await redisCommand(["GET", userKey(normalized)]);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to parse user payload", error);
    return null;
  }
}

async function saveUser({ fullName, username, password }) {
  const normalized = normalizeUsername(username);
  const record = {
    fullName: fullName.trim(),
    username: normalized,
    passwordHash: hashPassword(password),
  };
  await redisPipeline([
    ["SET", userKey(normalized), JSON.stringify(record)],
    ["HSET", "users", normalized, record.fullName],
  ]);
  return record;
}

async function createSession(username) {
  const token = crypto.randomUUID();
  await redisCommand(["SET", sessionKey(token), username, "EX", "86400"]);
  return token;
}

async function getSessionUsername(token) {
  if (!token) return null;
  return redisCommand(["GET", sessionKey(token)]);
}

async function destroySession(token) {
  if (!token) return;
  await redisCommand(["DEL", sessionKey(token)]);
}

async function getConnections(username) {
  const entries = await redisCommand(["HGETALL", connectionsKey(username)]);
  const result = {};
  if (!Array.isArray(entries)) {
    return result;
  }
  for (let index = 0; index < entries.length; index += 2) {
    const key = entries[index];
    const raw = entries[index + 1];
    if (!key || !raw) continue;
    try {
      result[key] = JSON.parse(raw);
    } catch (error) {
      console.error(`Failed to parse connection for ${key}`, error);
    }
  }
  return result;
}

async function saveConnection(username, target, state) {
  const key = connectionsKey(username);
  if (state.status === "none") {
    await redisCommand(["HDEL", key, target]);
    return { status: "none", anonymous: false };
  }
  const payload = JSON.stringify({
    status: state.status,
    anonymous: Boolean(state.anonymous),
  });
  await redisCommand(["HSET", key, target, payload]);
  return { status: state.status, anonymous: Boolean(state.anonymous) };
}

async function saveSelectedThread(username, thread) {
  await redisCommand(["SET", selectedThreadKey(username), JSON.stringify(thread), "EX", "3600"]);
  return thread;
}

async function getSelectedThread(username) {
  const raw = await redisCommand(["GET", selectedThreadKey(username)]);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to parse selected thread", error);
    return null;
  }
}

async function recordInviteRequest(payload) {
  await redisCommand(["LPUSH", "inviteRequests", JSON.stringify(payload)]);
}

async function authenticate(req, res, next) {
  const header = req.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const token = header.slice(7).trim();
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }
  try {
    const username = await getSessionUsername(token);
    if (!username) {
      return res.status(401).json({ message: "Session expired" });
    }
    const user = await getUser(username);
    if (!user) {
      await destroySession(token);
      return res.status(401).json({ message: "Account missing" });
    }
    req.user = user;
    req.sessionToken = token;
    next();
  } catch (error) {
    console.error("Failed to authenticate session", error);
    res.status(500).json({ message: "Unable to validate session" });
  }
}

app.post("/api/signup", async (req, res) => {
  const { fullName, username, password } = req.body ?? {};
  if (!fullName?.trim() || !username?.trim() || !password) {
    return res.status(400).json({ message: "Full name, username, and password are required" });
  }
  try {
    const normalized = normalizeUsername(username);
    const existing = await getUser(normalized);
    if (existing) {
      return res.status(409).json({ message: "Username is already taken" });
    }
    const user = await saveUser({ fullName, username: normalized, password });
    res.status(201).json({
      message: "Account created",
      user: { fullName: user.fullName, username: user.username },
    });
  } catch (error) {
    console.error("Failed to sign up", error);
    res.status(500).json({ message: "Unable to create account" });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username?.trim() || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }
  try {
    const normalized = normalizeUsername(username);
    const user = await getUser(normalized);
    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ message: "Invalid username or password" });
    }
    const token = await createSession(user.username);
    res.json({
      message: "Logged in",
      token,
      user: { fullName: user.fullName, username: user.username },
    });
  } catch (error) {
    console.error("Failed to log in", error);
    res.status(500).json({ message: "Unable to log in" });
  }
});

app.get("/api/session", authenticate, (req, res) => {
  res.json({ user: { fullName: req.user.fullName, username: req.user.username } });
});

app.post("/api/logout", authenticate, async (req, res) => {
  try {
    await destroySession(req.sessionToken);
    res.status(204).end();
  } catch (error) {
    console.error("Failed to log out", error);
    res.status(500).json({ message: "Unable to log out" });
  }
});

app.get("/api/lookup", authenticate, async (req, res) => {
  try {
    const statuses = await getConnections(req.user.username);
    res.json({ statuses });
  } catch (error) {
    console.error("Failed to load lookup state", error);
    res.status(500).json({ message: "Unable to load lookup state" });
  }
});

app.post("/api/status", authenticate, async (req, res) => {
  const { targetUsername, status, anonymous } = req.body ?? {};
  const normalizedTarget = normalizeUsername(targetUsername);
  const validStatuses = new Set(["none", "know", "want", "both"]);
  if (!normalizedTarget || !validStatuses.has(status)) {
    return res.status(400).json({ message: "A valid target and status are required" });
  }
  try {
    const saved = await saveConnection(req.user.username, normalizedTarget, {
      status,
      anonymous: Boolean(anonymous),
    });
    res.json({ connection: { username: normalizedTarget, ...saved } });
  } catch (error) {
    console.error("Failed to save connection", error);
    res.status(500).json({ message: "Unable to update status" });
  }
});

app.post("/api/messages/selection", authenticate, async (req, res) => {
  const { threadId, person, name, status, anonymous } = req.body ?? {};
  if (!threadId || !person || !name) {
    return res.status(400).json({ message: "Thread details are required" });
  }
  try {
    const payload = await saveSelectedThread(req.user.username, {
      threadId,
      person: normalizeUsername(person),
      name,
      status: status ?? "none",
      anonymous: Boolean(anonymous),
    });
    res.json({ thread: payload });
  } catch (error) {
    console.error("Failed to store selected thread", error);
    res.status(500).json({ message: "Unable to remember selected thread" });
  }
});

app.get("/api/messages/selection", authenticate, async (req, res) => {
  try {
    const thread = await getSelectedThread(req.user.username);
    if (!thread) {
      return res.status(404).json({ message: "No stored thread" });
    }
    res.json({ thread });
  } catch (error) {
    console.error("Failed to load selected thread", error);
    res.status(500).json({ message: "Unable to load selected thread" });
  }
});

app.post("/api/request-access", async (req, res) => {
  const { fullName, desiredUsername } = req.body ?? {};
  if (!fullName?.trim() || !desiredUsername?.trim()) {
    return res.status(400).json({ message: "Full name and username are required" });
  }
  try {
    await recordInviteRequest({
      fullName: fullName.trim(),
      desiredUsername: normalizeUsername(desiredUsername),
      requestedAt: new Date().toISOString(),
    });
    res.json({ message: "Request received" });
  } catch (error) {
    console.error("Failed to record invite request", error);
    res.status(500).json({ message: "Unable to save invite request" });
  }
});

app.get("/api/users", authenticate, async (req, res) => {
  try {
    const entries = await redisCommand(["HGETALL", "users"]);
    const users = [];
    if (Array.isArray(entries)) {
      for (let index = 0; index < entries.length; index += 2) {
        const username = entries[index];
        const fullName = entries[index + 1];
        users.push({ username, fullName });
      }
    }
    res.json({ users });
  } catch (error) {
    console.error("Failed to list users", error);
    res.status(500).json({ message: "Unable to load users" });
  }
});

app.use((err, req, res, next) => {
  console.error("Unhandled error", err);
  res.status(500).json({ message: "Unexpected server error" });
});

app.listen(PORT, () => {
  if (!HAS_UPSTASH_CONFIG) {
    console.warn("Upstash configuration missing. Set UPSTASH_REST_URL and UPSTASH_REST_TOKEN to enable persistence.");
  }
  console.log(`WantYou server listening on port ${PORT}`);
});
