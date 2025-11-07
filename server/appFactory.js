const path = require("path");
const crypto = require("crypto");
const express = require("express");

const UPSTASH_REST_URL = process.env.KV_REST_API_URL;
const UPSTASH_REST_TOKEN = process.env.KV_REST_API_TOKEN;
const HAS_UPSTASH_CONFIG = Boolean(UPSTASH_REST_URL && UPSTASH_REST_TOKEN);

const DEFAULT_CONNECTION_STATE = Object.freeze({
  status: "none",
  anonymous: false,
  updatedAt: null,
});

const memoryStore = {
  strings: new Map(),
  hashes: new Map(),
  lists: new Map(),
  sortedSets: new Map(),
  expirations: new Map(),
};

function normalizeCommandName(name = "") {
  return name.toUpperCase();
}

function now() {
  return Date.now();
}

function cleanupIfExpired(key) {
  const expiresAt = memoryStore.expirations.get(key);
  if (expiresAt && expiresAt <= now()) {
    memoryStore.expirations.delete(key);
    memoryStore.strings.delete(key);
    memoryStore.hashes.delete(key);
    memoryStore.lists.delete(key);
    memoryStore.sortedSets.delete(key);
  }
}

function handleMemorySet(args) {
  const [key, value, option, ttl] = args;
  memoryStore.strings.set(key, value);
  memoryStore.hashes.delete(key);
  memoryStore.lists.delete(key);
  memoryStore.sortedSets.delete(key);

  if (option?.toUpperCase() === "EX" && ttl !== undefined) {
    const ttlMs = Number(ttl) * 1000;
    if (Number.isFinite(ttlMs)) {
      memoryStore.expirations.set(key, now() + ttlMs);
    }
  } else {
    memoryStore.expirations.delete(key);
  }

  return "OK";
}

function handleMemoryGet([key]) {
  cleanupIfExpired(key);
  return memoryStore.strings.has(key) ? memoryStore.strings.get(key) : null;
}

function handleMemoryDel(args) {
  let removed = 0;
  args.forEach((key) => {
    cleanupIfExpired(key);
    if (
      memoryStore.strings.delete(key) ||
      memoryStore.hashes.delete(key) ||
      memoryStore.lists.delete(key) ||
      memoryStore.sortedSets.delete(key)
    ) {
      removed += 1;
    }
    memoryStore.expirations.delete(key);
  });
  return removed;
}

function getHash(key) {
  cleanupIfExpired(key);
  if (!memoryStore.hashes.has(key)) {
    memoryStore.hashes.set(key, new Map());
  }
  return memoryStore.hashes.get(key);
}

function handleMemoryHSet([key, field, value]) {
  const hash = getHash(key);
  hash.set(field, value);
  return 1;
}

function handleMemoryHGetAll([key]) {
  cleanupIfExpired(key);
  const hash = memoryStore.hashes.get(key);
  if (!hash) return null;
  const entries = [];
  for (const [field, value] of hash.entries()) {
    entries.push(field, value);
  }
  return entries;
}

function handleMemoryHDel([key, field]) {
  cleanupIfExpired(key);
  const hash = memoryStore.hashes.get(key);
  if (!hash) return 0;
  const deleted = hash.delete(field) ? 1 : 0;
  if (hash.size === 0) {
    memoryStore.hashes.delete(key);
  }
  return deleted;
}

function getList(key) {
  cleanupIfExpired(key);
  if (!memoryStore.lists.has(key)) {
    memoryStore.lists.set(key, []);
  }
  return memoryStore.lists.get(key);
}

function handleMemoryLPush([key, value]) {
  const list = getList(key);
  list.unshift(value);
  return list.length;
}

function handleMemoryRPush([key, value]) {
  const list = getList(key);
  list.push(value);
  return list.length;
}

function handleMemoryLRange([key, startRaw, stopRaw]) {
  cleanupIfExpired(key);
  const list = memoryStore.lists.get(key) || [];
  let start = Number(startRaw);
  let stop = Number(stopRaw);
  if (Number.isNaN(start)) start = 0;
  if (Number.isNaN(stop)) stop = list.length - 1;
  if (start < 0) start = list.length + start;
  if (stop < 0) stop = list.length + stop;
  start = Math.max(0, start);
  stop = Math.min(list.length - 1, stop);
  if (start > stop || start >= list.length) {
    return [];
  }
  return list.slice(start, stop + 1);
}

function getSortedSet(key) {
  cleanupIfExpired(key);
  if (!memoryStore.sortedSets.has(key)) {
    memoryStore.sortedSets.set(key, new Map());
  }
  return memoryStore.sortedSets.get(key);
}

function handleMemoryZAdd([key, scoreRaw, member]) {
  const score = Number(scoreRaw);
  if (!Number.isFinite(score)) return 0;
  const sortedSet = getSortedSet(key);
  sortedSet.set(member, score);
  return 1;
}

function handleMemoryZRevRange(args) {
  const [key, startRaw, stopRaw, maybeOption] = args;
  cleanupIfExpired(key);
  const sortedSet = memoryStore.sortedSets.get(key) || new Map();
  const items = Array.from(sortedSet.entries()).sort((a, b) => b[1] - a[1]);
  let start = Number(startRaw);
  let stop = Number(stopRaw);
  if (Number.isNaN(start)) start = 0;
  if (Number.isNaN(stop)) stop = items.length - 1;
  if (start < 0) start = items.length + start;
  if (stop < 0) stop = items.length + stop;
  start = Math.max(0, start);
  stop = Math.min(items.length - 1, stop);
  if (start > stop || start >= items.length) {
    return [];
  }
  const slice = items.slice(start, stop + 1);
  const withScores = (maybeOption ?? "").toUpperCase() === "WITHSCORES";
  if (withScores) {
    return slice.flatMap(([member, score]) => [member, String(score)]);
  }
  return slice.map(([member]) => member);
}

const MEMORY_COMMANDS = {
  SET: handleMemorySet,
  GET: handleMemoryGet,
  DEL: handleMemoryDel,
  HSET: handleMemoryHSet,
  HGETALL: handleMemoryHGetAll,
  HDEL: handleMemoryHDel,
  LPUSH: handleMemoryLPush,
  RPUSH: handleMemoryRPush,
  LRANGE: handleMemoryLRange,
  ZADD: handleMemoryZAdd,
  ZREVRANGE: handleMemoryZRevRange,
};

async function memoryCommand(command) {
  const [name, ...args] = command;
  const handler = MEMORY_COMMANDS[normalizeCommandName(name)];
  if (!handler) {
    throw new Error(`Unsupported memory command: ${name}`);
  }
  return handler(args);
}

async function memoryPipeline(commands) {
  const results = [];
  for (const command of commands) {
    results.push(await memoryCommand(command));
  }
  return results;
}

async function redisPipeline(commands) {
  if (!commands.length) {
    return [];
  }
  if (!HAS_UPSTASH_CONFIG) {
    return memoryPipeline(commands);
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

function sessionKey(token) {
  return `session:${token}`;
}

function userKey(username) {
  return `user:${username}`;
}

function outgoingConnectionsKey(username) {
  return `connections:${username}:outgoing`;
}

function incomingConnectionsKey(username) {
  return `connections:${username}:incoming`;
}

function selectedThreadKey(username) {
  return `selected:${username}`;
}

function conversationId(usernameA, usernameB) {
  const first = normalizeUsername(usernameA);
  const second = normalizeUsername(usernameB);
  if (!first || !second) return null;
  return [first, second].sort().join(":");
}

function conversationMessagesKey(id) {
  return `conversation:${id}:messages`;
}

function conversationMetaKey(id) {
  return `conversation:${id}:meta`;
}

function normalizeUsername(username = "") {
  return username.trim().toLowerCase();
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function parseJsonSafe(raw, fallback = null) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

async function getUser(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  const raw = await redisCommand(["GET", userKey(normalized)]);
  if (!raw) return null;
  const record = parseJsonSafe(raw, null);
  if (!record) return null;
  return {
    fullName: record.fullName,
    username: record.username ?? normalized,
    passwordHash: record.passwordHash,
    tagline: record.tagline ?? "",
  };
}

async function saveUser({ fullName, username, password }) {
  const normalized = normalizeUsername(username);
  const record = {
    fullName: fullName.trim(),
    username: normalized,
    passwordHash: hashPassword(password),
    tagline: "",
  };
  await redisPipeline([
    ["SET", userKey(normalized), JSON.stringify(record)],
    ["HSET", "users", normalized, JSON.stringify({ fullName: record.fullName, tagline: record.tagline })],
  ]);
  return record;
}

async function updateUserProfile(username, updates) {
  const existing = await getUser(username);
  if (!existing) return null;
  const next = {
    ...existing,
    ...updates,
  };
  await redisPipeline([
    ["SET", userKey(existing.username), JSON.stringify(next)],
    [
      "HSET",
      "users",
      existing.username,
      JSON.stringify({ fullName: next.fullName, tagline: next.tagline ?? "" }),
    ],
  ]);
  return next;
}

async function listUsers() {
  const entries = await redisCommand(["HGETALL", "users"]);
  if (!Array.isArray(entries)) {
    return [];
  }
  const users = [];
  for (let index = 0; index < entries.length; index += 2) {
    const username = entries[index];
    const raw = entries[index + 1];
    if (!username) continue;
    const parsed = parseJsonSafe(raw, null);
    if (parsed) {
      users.push({ username, fullName: parsed.fullName, tagline: parsed.tagline ?? "" });
    } else {
      users.push({ username, fullName: raw, tagline: "" });
    }
  }
  return users;
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

function parseConnectionRecord(raw) {
  const parsed = parseJsonSafe(raw, null);
  if (!parsed) {
    return { ...DEFAULT_CONNECTION_STATE };
  }
  return {
    status: parsed.status ?? "none",
    anonymous: Boolean(parsed.anonymous),
    updatedAt: parsed.updatedAt ?? null,
  };
}

async function readConnectionMap(key) {
  const entries = await redisCommand(["HGETALL", key]);
  const result = {};
  if (!Array.isArray(entries)) {
    return result;
  }
  for (let index = 0; index < entries.length; index += 2) {
    const username = entries[index];
    const raw = entries[index + 1];
    if (!username) continue;
    result[username] = parseConnectionRecord(raw);
  }
  return result;
}

async function getOutgoingConnections(username) {
  return readConnectionMap(outgoingConnectionsKey(username));
}

async function getIncomingConnections(username) {
  return readConnectionMap(incomingConnectionsKey(username));
}

function buildConnectionState(state) {
  if (!state) {
    return { ...DEFAULT_CONNECTION_STATE };
  }
  return {
    status: state.status ?? "none",
    anonymous: Boolean(state.anonymous),
    updatedAt: state.updatedAt ?? null,
  };
}

async function saveConnection(actorUsername, targetUsername, state) {
  const actor = normalizeUsername(actorUsername);
  const target = normalizeUsername(targetUsername);
  if (!actor || !target || actor === target) {
    throw new Error("A valid, distinct target is required");
  }

  const safeState = {
    status: state.status ?? "none",
    anonymous: Boolean(state.anonymous),
    updatedAt: new Date().toISOString(),
  };

  if (safeState.status === "none") {
    await redisPipeline([
      ["HDEL", outgoingConnectionsKey(actor), target],
      ["HDEL", incomingConnectionsKey(target), actor],
    ]);
    return buildConnectionState({ status: "none", anonymous: false, updatedAt: safeState.updatedAt });
  }

  const payload = JSON.stringify(safeState);
  await redisPipeline([
    ["HSET", outgoingConnectionsKey(actor), target, payload],
    ["HSET", incomingConnectionsKey(target), actor, payload],
  ]);
  return buildConnectionState(safeState);
}

async function saveSelectedThread(username, thread) {
  await redisPipeline([
    ["SET", selectedThreadKey(username), JSON.stringify(thread), "EX", "3600"],
  ]);
  return thread;
}

async function getSelectedThread(username) {
  const raw = await redisCommand(["GET", selectedThreadKey(username)]);
  if (!raw) return null;
  return parseJsonSafe(raw, null);
}

async function recordInviteRequest(payload) {
  await redisCommand(["LPUSH", "inviteRequests", JSON.stringify(payload)]);
}

function connectionStateFor(username, map = {}) {
  return buildConnectionState(map[username]);
}

async function getLookupPeople(currentUsername) {
  const [users, incoming, outgoing] = await Promise.all([
    listUsers(),
    getIncomingConnections(currentUsername),
    getOutgoingConnections(currentUsername),
  ]);
  return users
    .filter((user) => user.username !== currentUsername)
    .map((user) => ({
      username: user.username,
      fullName: user.fullName,
      tagline: user.tagline ?? "",
      inbound: connectionStateFor(user.username, incoming),
      outbound: connectionStateFor(user.username, outgoing),
    }));
}

function countStatuses(incoming) {
  const stats = { know: 0, want: 0, both: 0 };
  Object.values(incoming).forEach((state) => {
    switch (state.status) {
      case "know":
        stats.know += 1;
        break;
      case "want":
        stats.want += 1;
        break;
      case "both":
        stats.both += 1;
        break;
      default:
        break;
    }
  });
  return stats;
}

function timestampScore(value) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function buildAnonymousList({ incoming, userMap }) {
  return Object.entries(incoming)
    .filter(([, state]) => (state.status === "want" || state.status === "both") && state.anonymous)
    .map(([username, state]) => {
      const user = userMap.get(username);
      return {
        username,
        fullName: user?.fullName ?? username,
        status: state.status,
        updatedAt: state.updatedAt,
      };
    });
}

function buildRecentUpdates({ incoming, outgoing, userMap, limit = 5 }) {
  const updates = [];
  Object.entries(incoming).forEach(([username, state]) => {
    if (!state.updatedAt || state.status === "none") return;
    const user = userMap.get(username);
    updates.push({
      username,
      fullName: user?.fullName ?? username,
      status: state.status,
      direction: "inbound",
      updatedAt: state.updatedAt,
      anonymous: state.anonymous,
    });
  });
  Object.entries(outgoing).forEach(([username, state]) => {
    if (!state.updatedAt || state.status === "none") return;
    const user = userMap.get(username);
    updates.push({
      username,
      fullName: user?.fullName ?? username,
      status: state.status,
      direction: "outbound",
      updatedAt: state.updatedAt,
      anonymous: state.anonymous,
    });
  });
  updates.sort((a, b) => timestampScore(b.updatedAt) - timestampScore(a.updatedAt));
  return updates.slice(0, limit);
}

function formatDisplayName(person, inbound) {
  const wantsPrivacy =
    (inbound.status === "want" || inbound.status === "both") && inbound.anonymous;
  return wantsPrivacy ? "Anonymous user" : person.fullName;
}

function formatAliasForCurrentUser(currentUser, outbound) {
  const wantsPrivacy =
    (outbound.status === "want" || outbound.status === "both") && outbound.anonymous;
  return wantsPrivacy ? "Anonymous" : currentUser.fullName;
}

async function getConversationMessages(usernameA, usernameB) {
  const id = conversationId(usernameA, usernameB);
  if (!id) return [];
  const rawMessages = await redisCommand(["LRANGE", conversationMessagesKey(id), "0", "-1"]);
  if (!Array.isArray(rawMessages)) {
    return [];
  }
  return rawMessages
    .map((entry) => parseJsonSafe(entry, null))
    .filter(Boolean);
}

async function appendConversationMessage(from, to, text) {
  const id = conversationId(from, to);
  if (!id) {
    throw new Error("Conversation participants are required");
  }
  const message = {
    id: crypto.randomUUID(),
    sender: normalizeUsername(from),
    text,
    createdAt: new Date().toISOString(),
  };
  const meta = {
    lastMessage: message,
    updatedAt: message.createdAt,
  };
  await redisPipeline([
    ["RPUSH", conversationMessagesKey(id), JSON.stringify(message)],
    ["SET", conversationMetaKey(id), JSON.stringify(meta)],
  ]);
  return message;
}

async function getConversationMetaRecords(currentUsername, people) {
  if (!people.length) {
    return new Map();
  }
  const commands = people.map((person) => {
    const id = conversationId(currentUsername, person.username);
    return ["GET", conversationMetaKey(id)];
  });
  const results = await redisPipeline(commands);
  const meta = new Map();
  results.forEach((raw, index) => {
    const person = people[index];
    meta.set(person.username, parseJsonSafe(raw, null));
  });
  return meta;
}

function publicUser(user) {
  return {
    fullName: user.fullName,
    username: user.username,
    tagline: user.tagline ?? "",
  };
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
    req.user = publicUser(user);
    req.sessionToken = token;
    next();
  } catch (error) {
    console.error("Failed to authenticate session", error);
    res.status(500).json({ message: "Unable to validate session" });
  }
}

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.resolve(__dirname, "..")));

  app.post("/api/signup", async (req, res) => {
    const { fullName, username, password } = req.body ?? {};
    if (!fullName?.trim() || !username?.trim() || !password) {
      return res
        .status(400)
        .json({ message: "Full name, username, and password are required" });
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
        user: publicUser(user),
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
        user: publicUser(user),
      });
    } catch (error) {
      console.error("Failed to log in", error);
      res.status(500).json({ message: "Unable to log in" });
    }
  });

  app.get("/api/session", authenticate, (req, res) => {
    res.json({ user: req.user });
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
      const people = await getLookupPeople(req.user.username);
      res.json({ people });
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
      const targetUser = await getUser(normalizedTarget);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      await saveConnection(req.user.username, normalizedTarget, {
        status,
        anonymous: Boolean(anonymous),
      });
      const [incoming, outgoing] = await Promise.all([
        getIncomingConnections(req.user.username),
        getOutgoingConnections(req.user.username),
      ]);
      res.json({
        connection: {
          username: normalizedTarget,
          inbound: connectionStateFor(normalizedTarget, incoming),
          outbound: connectionStateFor(normalizedTarget, outgoing),
        },
      });
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
      const users = (await listUsers()).filter(
        (user) => user.username !== req.user.username
      );
      res.json({ users });
    } catch (error) {
      console.error("Failed to list users", error);
      res.status(500).json({ message: "Unable to load users" });
    }
  });

  app.get("/api/messages/threads", authenticate, async (req, res) => {
    try {
      const people = await getLookupPeople(req.user.username);
      const metaMap = await getConversationMetaRecords(req.user.username, people);
      const threads = people.map((person) => {
        const inbound = person.inbound;
        const outbound = person.outbound;
        const meta = metaMap.get(person.username) ?? null;
        const lastMessage = meta?.lastMessage ?? null;
        const updatedAt =
          meta?.updatedAt ?? outbound.updatedAt ?? inbound.updatedAt ?? null;
        return {
          username: person.username,
          fullName: person.fullName,
          displayName: formatDisplayName(person, inbound),
          tagline: person.tagline ?? "",
          inbound,
          outbound,
          lastMessage: lastMessage
            ? {
                sender: lastMessage.sender,
                text: lastMessage.text,
                createdAt: lastMessage.createdAt,
              }
            : null,
          updatedAt,
        };
      });
      threads.sort((a, b) => {
        const delta = timestampScore(b.updatedAt) - timestampScore(a.updatedAt);
        if (delta !== 0) return delta;
        return a.displayName.localeCompare(b.displayName);
      });
      res.json({ threads });
    } catch (error) {
      console.error("Failed to list conversations", error);
      res.status(500).json({ message: "Unable to load conversations" });
    }
  });

  app.get("/api/messages/thread/:username", authenticate, async (req, res) => {
    const normalizedTarget = normalizeUsername(req.params.username);
    if (!normalizedTarget) {
      return res.status(400).json({ message: "A valid username is required" });
    }
    try {
      const targetUser = await getUser(normalizedTarget);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const [incoming, outgoing, messages] = await Promise.all([
        getIncomingConnections(req.user.username),
        getOutgoingConnections(req.user.username),
        getConversationMessages(req.user.username, normalizedTarget),
      ]);
      const inbound = connectionStateFor(normalizedTarget, incoming);
      const outbound = connectionStateFor(normalizedTarget, outgoing);
      const thread = {
        username: targetUser.username,
        fullName: targetUser.fullName,
        displayName: formatDisplayName(targetUser, inbound),
        tagline: targetUser.tagline ?? "",
        inbound,
        outbound,
        alias: formatAliasForCurrentUser(req.user, outbound),
        messages: messages.map((message) => ({
          id: message.id,
          sender: message.sender,
          text: message.text,
          createdAt: message.createdAt,
        })),
      };
      res.json({ thread });
    } catch (error) {
      console.error("Failed to load conversation", error);
      res.status(500).json({ message: "Unable to load conversation" });
    }
  });

  app.post("/api/messages/thread/:username", authenticate, async (req, res) => {
    const normalizedTarget = normalizeUsername(req.params.username);
    const { text } = req.body ?? {};
    if (!normalizedTarget) {
      return res.status(400).json({ message: "A valid username is required" });
    }
    const trimmed = text?.trim();
    if (!trimmed) {
      return res.status(400).json({ message: "A message is required" });
    }
    try {
      const targetUser = await getUser(normalizedTarget);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const message = await appendConversationMessage(
        req.user.username,
        normalizedTarget,
        trimmed
      );
      res.status(201).json({
        message: {
          id: message.id,
          sender: message.sender,
          text: message.text,
          createdAt: message.createdAt,
        },
      });
    } catch (error) {
      console.error("Failed to save message", error);
      res.status(500).json({ message: "Unable to send message" });
    }
  });

  app.get("/api/profile", authenticate, async (req, res) => {
    try {
      const [incoming, outgoing, users] = await Promise.all([
        getIncomingConnections(req.user.username),
        getOutgoingConnections(req.user.username),
        listUsers(),
      ]);
      const userMap = new Map(users.map((user) => [user.username, user]));
      const stats = countStatuses(incoming);
      const anonymous = buildAnonymousList({ incoming, userMap });
      const recent = buildRecentUpdates({ incoming, outgoing, userMap });
      res.json({
        user: req.user,
        stats,
        anonymous,
        recent,
      });
    } catch (error) {
      console.error("Failed to load profile", error);
      res.status(500).json({ message: "Unable to load profile" });
    }
  });

  app.put("/api/profile", authenticate, async (req, res) => {
    const { fullName, tagline } = req.body ?? {};
    const updates = {};
    if (fullName !== undefined) {
      if (!fullName || !fullName.trim()) {
        return res.status(400).json({ message: "Full name cannot be empty" });
      }
      updates.fullName = fullName.trim();
    }
    if (tagline !== undefined) {
      updates.tagline = tagline.trim();
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "No updates provided" });
    }
    if (updates.tagline && updates.tagline.length > 160) {
      return res.status(400).json({ message: "Tagline must be 160 characters or fewer" });
    }
    try {
      const updated = await updateUserProfile(req.user.username, updates);
      if (!updated) {
        return res.status(404).json({ message: "Account missing" });
      }
      req.user.fullName = updated.fullName;
      req.user.tagline = updated.tagline ?? "";
      res.json({ user: req.user });
    } catch (error) {
      console.error("Failed to update profile", error);
      res.status(500).json({ message: "Unable to update profile" });
    }
  });

  app.use((err, req, res, next) => {
    console.error("Unhandled error", err);
    res.status(500).json({ message: "Unexpected server error" });
  });

  return app;
}

module.exports = { createApp, HAS_UPSTASH_CONFIG };
