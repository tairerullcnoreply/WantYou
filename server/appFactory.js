const path = require("path");
const os = require("os");
const fs = require("fs");
const fsp = require("fs/promises");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");

const UPSTASH_REST_URL = process.env.KV_REST_API_URL;
const UPSTASH_REST_TOKEN = process.env.KV_REST_API_TOKEN;
const HAS_UPSTASH_CONFIG = Boolean(UPSTASH_REST_URL && UPSTASH_REST_TOKEN);

const OWNER_USERNAME = "wantyou";

const BADGE_TYPES = Object.freeze({
  WANTYOU: "WantYou",
  VERIFIED: "Verified",
});

const VALID_BADGES = new Set(Object.values(BADGE_TYPES));

const DEFAULT_CONNECTION_STATE = Object.freeze({
  status: "none",
  anonymous: false,
  alias: "",
  updatedAt: null,
});

const MAX_MEDIA_FILE_SIZE = 100 * 1024 * 1024; // 100 MB per GitHub upload limit
const PROJECT_ROOT = path.resolve(__dirname, "..");

function resolveUploadRoot() {
  const explicit = process.env.UPLOAD_ROOT?.trim();
  if (explicit) {
    const absolute = path.resolve(explicit);
    ensureDirectory(absolute);
    return absolute;
  }

  const projectUploads = path.join(PROJECT_ROOT, "uploads");
  try {
    ensureDirectory(projectUploads);
    fs.accessSync(projectUploads, fs.constants.W_OK);
    return projectUploads;
  } catch (error) {
    const fallback = path.join(os.tmpdir(), "wantyou", "uploads");
    ensureDirectory(fallback);
    console.warn(
      `Falling back to temporary upload directory at ${fallback} due to:`,
      error
    );
    return fallback;
  }
}

const UPLOAD_ROOT = resolveUploadRoot();
const AVATAR_UPLOAD_DIR = path.join(UPLOAD_ROOT, "avatars");
const POST_UPLOAD_DIR = path.join(UPLOAD_ROOT, "posts");
const EVENT_UPLOAD_DIR = path.join(UPLOAD_ROOT, "events");

function ensureDirectory(directory) {
  try {
    fs.mkdirSync(directory, { recursive: true });
  } catch (error) {
    console.warn(`Unable to ensure upload directory ${directory}`, error);
  }
}

ensureDirectory(UPLOAD_ROOT);
ensureDirectory(AVATAR_UPLOAD_DIR);
ensureDirectory(POST_UPLOAD_DIR);
ensureDirectory(EVENT_UPLOAD_DIR);

function normalizeBadgeList(badges) {
  if (!Array.isArray(badges)) {
    return [];
  }
  const seen = new Set();
  const normalized = [];
  badges.forEach((badge) => {
    if (typeof badge !== "string") return;
    const trimmed = badge.trim();
    if (!VALID_BADGES.has(trimmed) || seen.has(trimmed)) return;
    seen.add(trimmed);
    normalized.push(trimmed);
  });
  return normalized;
}

function enforceBadgeRules(username, badges) {
  const list = normalizeBadgeList(badges);
  if (username === OWNER_USERNAME) {
    if (!list.includes(BADGE_TYPES.WANTYOU)) {
      list.unshift(BADGE_TYPES.WANTYOU);
    }
    return list;
  }
  return list.filter((badge) => badge !== BADGE_TYPES.WANTYOU);
}

function sanitizeUserRecord(record) {
  if (!record || !record.username) {
    throw new Error("User record must include a username");
  }
  return {
    fullName: typeof record.fullName === "string" ? record.fullName.trim() : "",
    username: normalizeUsername(record.username),
    passwordHash: record.passwordHash,
    tagline: typeof record.tagline === "string" ? record.tagline : "",
    bio: typeof record.bio === "string" ? record.bio : "",
    profilePicturePath:
      typeof record.profilePicturePath === "string" ? record.profilePicturePath : "",
    badges: enforceBadgeRules(normalizeUsername(record.username), record.badges),
  };
}

function buildUserSummaryPayload(user) {
  return JSON.stringify({
    fullName: user.fullName,
    tagline: user.tagline ?? "",
    badges: Array.isArray(user.badges) ? user.badges : [],
  });
}

async function writeUserRecord(record) {
  const sanitized = sanitizeUserRecord(record);
  await redisPipeline([
    ["SET", userKey(sanitized.username), JSON.stringify(sanitized)],
    ["HSET", "users", sanitized.username, buildUserSummaryPayload(sanitized)],
  ]);
  return sanitized;
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

function isAllowedMediaType(mime) {
  return ALLOWED_IMAGE_TYPES.has(mime) || ALLOWED_VIDEO_TYPES.has(mime);
}

const uploadStorage = multer.diskStorage({
  destination(req, file, cb) {
    const target = req.uploadTarget;
    let directory = POST_UPLOAD_DIR;
    if (target === "avatar") {
      directory = AVATAR_UPLOAD_DIR;
    } else if (target === "event") {
      directory = EVENT_UPLOAD_DIR;
    }
    ensureDirectory(directory);
    cb(null, directory);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const unique = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    cb(null, unique);
  },
});

const uploadMiddleware = multer({
  storage: uploadStorage,
  limits: { fileSize: MAX_MEDIA_FILE_SIZE },
  fileFilter(req, file, cb) {
    if (!file.mimetype) {
      cb(new Error("Unsupported file type"));
      return;
    }
    if (req.uploadTarget === "avatar") {
      if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
        cb(new Error("Profile pictures must be an image"));
        return;
      }
    } else if (!isAllowedMediaType(file.mimetype)) {
      cb(new Error("Only JPG, PNG, GIF, WEBP, MP4, or WEBM files are allowed"));
      return;
    }
    cb(null, true);
  },
});

async function removeFileSafe(filePath) {
  if (!filePath) return;
  try {
    await fsp.unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn(`Unable to remove file at ${filePath}`, error);
    }
  }
}

function uploadErrorResponse(res, error) {
  if (error?.code === "LIMIT_FILE_SIZE") {
    return res
      .status(413)
      .json({ message: "Files must be 100 MB or smaller." });
  }
  return res.status(400).json({ message: error?.message || "Unable to process upload" });
}

let upstashUnavailable = false;

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

function buildUpstashUrl(pathname) {
  const base = new URL(UPSTASH_REST_URL);
  const normalizedPath = `${base.pathname.replace(/\/+$/, "")}/${pathname.replace(/^\/+/, "")}`;
  base.pathname = normalizedPath;
  return base.toString();
}

async function redisPipeline(commands) {
  if (!commands.length) {
    return [];
  }
  if (!HAS_UPSTASH_CONFIG || upstashUnavailable) {
    return memoryPipeline(commands);
  }

  try {
    const pipelineUrl = buildUpstashUrl("pipeline");
    const response = await fetch(pipelineUrl, {
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
  } catch (error) {
    console.warn("Upstash unavailable, falling back to in-memory store", error);
    upstashUnavailable = true;
    return memoryPipeline(commands);
  }
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

function userEventsKey(username) {
  return `user:${username}:events`;
}

function userPostsKey(username) {
  return `user:${username}:posts`;
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

function relativeUploadPath(filePath) {
  if (!filePath) return null;
  const resolved = path.resolve(filePath);
  if (resolved.startsWith(UPLOAD_ROOT)) {
    const relativeToUpload = path.relative(UPLOAD_ROOT, resolved);
    if (!relativeToUpload) return null;
    return `/uploads/${relativeToUpload.split(path.sep).join("/")}`;
  }
  const relativeToProject = path.relative(PROJECT_ROOT, resolved);
  if (!relativeToProject || relativeToProject.startsWith("..")) {
    return null;
  }
  return `/${relativeToProject.split(path.sep).join("/")}`;
}

function describeAttachment(file) {
  if (!file) return null;
  const type = ALLOWED_VIDEO_TYPES.has(file.mimetype) ? "video" : "image";
  return {
    id: crypto.randomUUID(),
    type,
    url: relativeUploadPath(file.path),
    originalName: file.originalname ?? "",
    size: file.size ?? 0,
    mimeType: file.mimetype,
  };
}

function absoluteUploadPath(relativePath) {
  if (!relativePath) return null;
  const normalized = relativePath.startsWith("/")
    ? relativePath.slice(1)
    : relativePath;
  if (normalized.startsWith("uploads/")) {
    return path.resolve(UPLOAD_ROOT, normalized.slice("uploads/".length));
  }
  return path.resolve(PROJECT_ROOT, normalized);
}

async function getUser(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  const raw = await redisCommand(["GET", userKey(normalized)]);
  if (!raw) return null;
  const record = parseJsonSafe(raw, null);
  if (!record) return null;
  const sanitized = sanitizeUserRecord({ ...record, username: record.username ?? normalized });
  return {
    ...sanitized,
    passwordHash: record.passwordHash,
  };
}

async function saveUser({ fullName, username, password }) {
  const normalized = normalizeUsername(username);
  const initialBadges = normalized === OWNER_USERNAME ? [BADGE_TYPES.WANTYOU] : [];
  const record = {
    fullName: fullName.trim(),
    username: normalized,
    passwordHash: hashPassword(password),
    tagline: "",
    bio: "",
    profilePicturePath: "",
    badges: initialBadges,
  };
  return writeUserRecord(record);
}

async function updateUserProfile(username, updates) {
  const existing = await getUser(username);
  if (!existing) return null;
  const next = {
    ...existing,
    ...updates,
  };
  const saved = await writeUserRecord(next);
  return { ...saved, passwordHash: existing.passwordHash };
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
      users.push({
        username,
        fullName: parsed.fullName,
        tagline: parsed.tagline ?? "",
        badges: enforceBadgeRules(username, parsed.badges),
      });
    } else {
      users.push({ username, fullName: raw, tagline: "", badges: [] });
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
    alias: typeof parsed.alias === "string" ? parsed.alias : "",
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
    alias: typeof state.alias === "string" ? state.alias : "",
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
    alias: typeof state.alias === "string" ? state.alias.trim() : "",
    updatedAt: new Date().toISOString(),
  };

  if (safeState.status === "none") {
    await redisPipeline([
      ["HDEL", outgoingConnectionsKey(actor), target],
      ["HDEL", incomingConnectionsKey(target), actor],
    ]);
    return buildConnectionState({
      status: "none",
      anonymous: false,
      alias: "",
      updatedAt: safeState.updatedAt,
    });
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
      badges: Array.isArray(user.badges) ? user.badges : [],
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
      const alias = state.alias?.trim();
      return {
        username,
        fullName: alias || user?.fullName || "Anonymous admirer",
        alias: alias || "Anonymous admirer",
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
    const alias = state.alias?.trim();
    updates.push({
      username,
      fullName:
        (state.anonymous && (state.status === "want" || state.status === "both") && alias) ||
        user?.fullName ||
        (state.anonymous ? "Anonymous admirer" : username),
      alias: alias || "",
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
      alias: state.alias?.trim() || "",
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
  if (wantsPrivacy) {
    return inbound.alias?.trim() || "Anonymous user";
  }
  return person.fullName;
}

function formatAliasForCurrentUser(currentUser, outbound) {
  const wantsPrivacy =
    (outbound.status === "want" || outbound.status === "both") && outbound.anonymous;
  if (wantsPrivacy) {
    return outbound.alias?.trim() || "Anonymous";
  }
  return currentUser.fullName;
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

async function rewriteList(key, entries) {
  const commands = [["DEL", key]];
  if (entries.length) {
    entries.forEach((entry) => {
      commands.push(["RPUSH", key, JSON.stringify(entry)]);
    });
  }
  await redisPipeline(commands);
}

function sortByNewest(records) {
  return records.slice().sort((a, b) => {
    const scoreA = timestampScore(a?.createdAt);
    const scoreB = timestampScore(b?.createdAt);
    return scoreB - scoreA;
  });
}

async function listUserEvents(username) {
  const key = userEventsKey(username);
  const raw = await redisCommand(["LRANGE", key, "0", "-1"]);
  if (!Array.isArray(raw)) {
    return [];
  }
  const nowIso = Date.now();
  const events = [];
  let changed = false;
  raw.forEach((item) => {
    const parsed = parseJsonSafe(item, null);
    if (!parsed) {
      changed = true;
      return;
    }
    const expires = parsed.expiresAt ? Date.parse(parsed.expiresAt) : null;
    if (expires && expires <= nowIso) {
      changed = true;
      return;
    }
    events.push(parsed);
  });
  if (changed) {
    await rewriteList(key, sortByNewest(events));
  }
  return sortByNewest(events);
}

async function saveUserEvent(username, event) {
  const key = userEventsKey(username);
  await redisCommand(["LPUSH", key, JSON.stringify(event)]);
  return event;
}

async function deleteUserEvent(username, eventId) {
  const events = await listUserEvents(username);
  const filtered = events.filter((event) => event.id !== eventId);
  if (filtered.length !== events.length) {
    await rewriteList(userEventsKey(username), sortByNewest(filtered));
  }
}

async function listUserPosts(username) {
  const key = userPostsKey(username);
  const raw = await redisCommand(["LRANGE", key, "0", "-1"]);
  if (!Array.isArray(raw)) {
    return [];
  }
  const posts = raw
    .map((item) => parseJsonSafe(item, null))
    .filter(Boolean)
    .map((post) => ({ ...post, attachments: Array.isArray(post.attachments) ? post.attachments : [] }));
  return sortByNewest(posts);
}

async function saveUserPost(username, post) {
  await redisCommand(["LPUSH", userPostsKey(username), JSON.stringify(post)]);
  return post;
}

async function deleteUserPost(username, postId) {
  const posts = await listUserPosts(username);
  const filtered = posts.filter((post) => post.id !== postId);
  if (filtered.length !== posts.length) {
    await rewriteList(userPostsKey(username), sortByNewest(filtered));
  }
  return posts.find((post) => post.id === postId) ?? null;
}

function publicUser(user) {
  const badges = enforceBadgeRules(user.username, user.badges);
  return {
    fullName: user.fullName,
    username: user.username,
    tagline: user.tagline ?? "",
    bio: user.bio ?? "",
    profilePicture: user.profilePicturePath ? user.profilePicturePath : "",
    badges,
  };
}

function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .map((attachment) => ({
      id: attachment.id,
      type: attachment.type,
      url: attachment.url,
      originalName: attachment.originalName ?? "",
      mimeType: attachment.mimeType ?? "",
      size: attachment.size ?? 0,
    }))
    .filter((attachment) => Boolean(attachment.url));
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
  app.use(express.static(PROJECT_ROOT));
  app.use("/uploads", express.static(UPLOAD_ROOT));

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
    const { targetUsername, status, anonymous, alias } = req.body ?? {};
    const normalizedTarget = normalizeUsername(targetUsername);
    const validStatuses = new Set(["none", "know", "want", "both"]);
    if (!normalizedTarget || !validStatuses.has(status)) {
      return res.status(400).json({ message: "A valid target and status are required" });
    }
    try {
      const [targetUser, existingOutgoing] = await Promise.all([
        getUser(normalizedTarget),
        getOutgoingConnections(req.user.username),
      ]);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const previousState = buildConnectionState(existingOutgoing[normalizedTarget]);
      const wantsPrivacy = (status === "want" || status === "both") && Boolean(anonymous);
      let nextAlias = "";
      if (wantsPrivacy) {
        const providedAlias = typeof alias === "string" ? alias.trim() : "";
        nextAlias = providedAlias || previousState.alias || "";
        if (!nextAlias) {
          return res.status(400).json({ message: "Choose a nickname to stay anonymous" });
        }
        if (nextAlias.length > 40) {
          return res.status(400).json({ message: "Nickname must be 40 characters or fewer" });
        }
      }
      await saveConnection(req.user.username, normalizedTarget, {
        status,
        anonymous: Boolean(anonymous),
        alias: wantsPrivacy ? nextAlias : "",
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
          badges: Array.isArray(person.badges) ? person.badges : [],
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
        badges: Array.isArray(targetUser.badges) ? targetUser.badges : [],
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
      const requested = normalizeUsername(req.query.user) || req.user.username;
      const targetUser = await getUser(requested);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const isSelf = requested === req.user.username;
      const [events, posts] = await Promise.all([
        listUserEvents(requested),
        listUserPosts(requested),
      ]);
      const response = {
        user: publicUser({ ...targetUser }),
        events: events.map((event) => ({
          id: event.id,
          text: event.text ?? "",
          attachments: normalizeAttachments(event.attachments),
          createdAt: event.createdAt,
          expiresAt: event.expiresAt,
        })),
        posts: posts.map((post) => ({
          id: post.id,
          text: post.text ?? "",
          attachments: normalizeAttachments(post.attachments),
          createdAt: post.createdAt,
          visibility: post.visibility ?? "public",
        })),
        canEdit: isSelf,
        maxUploadSize: MAX_MEDIA_FILE_SIZE,
      };

      const canVerify = req.user.username === OWNER_USERNAME && requested !== req.user.username;
      response.canVerify = canVerify;

      if (isSelf) {
        const [incoming, outgoing, users] = await Promise.all([
          getIncomingConnections(req.user.username),
          getOutgoingConnections(req.user.username),
          listUsers(),
        ]);
        const userMap = new Map(users.map((user) => [user.username, user]));
        response.stats = countStatuses(incoming);
        response.anonymous = buildAnonymousList({ incoming, userMap });
        response.recent = buildRecentUpdates({ incoming, outgoing, userMap });
      }

      res.json(response);
    } catch (error) {
      console.error("Failed to load profile", error);
      res.status(500).json({ message: "Unable to load profile" });
    }
  });

  app.put("/api/profile", authenticate, async (req, res) => {
    const { tagline, bio } = req.body ?? {};
    const updates = {};
    if (typeof tagline === "string") {
      if (tagline.length > 160) {
        return res.status(400).json({ message: "Tagline must be 160 characters or fewer" });
      }
      updates.tagline = tagline.trim();
    }
    if (typeof bio === "string") {
      if (bio.length > 500) {
        return res.status(400).json({ message: "Bio must be 500 characters or fewer" });
      }
      updates.bio = bio.trim();
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "Nothing to update" });
    }
    try {
      const updated = await updateUserProfile(req.user.username, updates);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      const user = publicUser(updated);
      res.json({ user });
    } catch (error) {
      console.error("Failed to update profile", error);
      res.status(500).json({ message: "Unable to update profile" });
    }
  });

  app.post("/api/badges/verify", authenticate, async (req, res) => {
    if (req.user.username !== OWNER_USERNAME) {
      return res
        .status(403)
        .json({ message: "Only the WantYou owner can manage verification badges" });
    }
    const { username, verified } = req.body ?? {};
    const normalizedTarget = normalizeUsername(username);
    if (!normalizedTarget) {
      return res.status(400).json({ message: "Username to verify is required" });
    }
    if (typeof verified !== "boolean") {
      return res
        .status(400)
        .json({ message: "Specify whether the user should be verified" });
    }
    try {
      const targetUser = await getUser(normalizedTarget);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const badgeSet = new Set(targetUser.badges);
      if (verified) {
        badgeSet.add(BADGE_TYPES.VERIFIED);
      } else {
        badgeSet.delete(BADGE_TYPES.VERIFIED);
      }
      const updated = await writeUserRecord({ ...targetUser, badges: [...badgeSet] });
      res.json({ user: publicUser(updated) });
    } catch (error) {
      console.error("Failed to update verification badge", error);
      res.status(500).json({ message: "Unable to update verification badge" });
    }
  });

  app.post("/api/profile/avatar", authenticate, (req, res) => {
    req.uploadTarget = "avatar";
    uploadMiddleware.single("avatar")(req, res, async (error) => {
      if (error) {
        return uploadErrorResponse(res, error);
      }
      if (!req.file) {
        return res.status(400).json({ message: "Select an image to upload" });
      }
      try {
        const user = await getUser(req.user.username);
        if (!user) {
          await removeFileSafe(req.file.path);
          return res.status(404).json({ message: "User not found" });
        }
        const previousPath = user.profilePicturePath
          ? absoluteUploadPath(user.profilePicturePath)
          : null;
        const pictureUrl = relativeUploadPath(req.file.path);
        const updated = await updateUserProfile(req.user.username, {
          profilePicturePath: pictureUrl,
        });
        if (previousPath && previousPath !== req.file.path) {
          await removeFileSafe(previousPath);
        }
        res.status(201).json({ user: publicUser(updated) });
      } catch (err) {
        console.error("Failed to upload profile picture", err);
        await removeFileSafe(req.file.path);
        res.status(500).json({ message: "Unable to update profile picture" });
      }
    });
  });

  app.post("/api/events", authenticate, (req, res) => {
    req.uploadTarget = "event";
    uploadMiddleware.array("media", 4)(req, res, async (error) => {
      if (error) {
        return uploadErrorResponse(res, error);
      }
      const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
      const attachments = Array.isArray(req.files)
        ? req.files.map((file) => describeAttachment(file)).filter(Boolean)
        : [];
      if (!text && !attachments.length) {
        await Promise.all(
          attachments.map((attachment) => {
            const abs = absoluteUploadPath(attachment.url);
            return abs ? removeFileSafe(abs) : Promise.resolve();
          })
        );
        return res.status(400).json({ message: "Add text or media to your event" });
      }
      try {
        const now = new Date();
        const event = {
          id: crypto.randomUUID(),
          text,
          attachments,
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        };
        await saveUserEvent(req.user.username, event);
        res.status(201).json({
          event: {
            id: event.id,
            text: event.text,
            attachments: normalizeAttachments(event.attachments),
            createdAt: event.createdAt,
            expiresAt: event.expiresAt,
          },
        });
      } catch (err) {
        console.error("Failed to save event", err);
        await Promise.all(
          attachments.map((attachment) => {
            const abs = absoluteUploadPath(attachment.url);
            return abs ? removeFileSafe(abs) : Promise.resolve();
          })
        );
        res.status(500).json({ message: "Unable to publish event" });
      }
    });
  });

  app.delete("/api/events/:id", authenticate, async (req, res) => {
    const eventId = req.params.id;
    if (!eventId) {
      return res.status(400).json({ message: "Event id required" });
    }
    try {
      const events = await listUserEvents(req.user.username);
      const target = events.find((event) => event.id === eventId);
      if (!target) {
        return res.status(404).json({ message: "Event not found" });
      }
      await deleteUserEvent(req.user.username, eventId);
      if (Array.isArray(target.attachments)) {
        await Promise.all(
          target.attachments.map(async (attachment) => {
            const abs = absoluteUploadPath(attachment.url);
            if (abs) {
              await removeFileSafe(abs);
            }
          })
        );
      }
      res.status(204).end();
    } catch (error) {
      console.error("Failed to delete event", error);
      res.status(500).json({ message: "Unable to delete event" });
    }
  });

  app.post("/api/posts", authenticate, (req, res) => {
    req.uploadTarget = "post";
    uploadMiddleware.array("media", 6)(req, res, async (error) => {
      if (error) {
        return uploadErrorResponse(res, error);
      }
      const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
      const attachments = Array.isArray(req.files)
        ? req.files.map((file) => describeAttachment(file)).filter(Boolean)
        : [];
      if (!text && !attachments.length) {
        await Promise.all(
          attachments.map((attachment) => {
            const abs = absoluteUploadPath(attachment.url);
            return abs ? removeFileSafe(abs) : Promise.resolve();
          })
        );
        return res.status(400).json({ message: "Posts must include text or media" });
      }
      try {
        const post = {
          id: crypto.randomUUID(),
          text,
          attachments,
          createdAt: new Date().toISOString(),
          visibility: "public",
        };
        await saveUserPost(req.user.username, post);
        res.status(201).json({
          post: {
            id: post.id,
            text: post.text,
            attachments: normalizeAttachments(post.attachments),
            createdAt: post.createdAt,
            visibility: post.visibility,
          },
        });
      } catch (err) {
        console.error("Failed to create post", err);
        await Promise.all(
          attachments.map((attachment) => {
            const abs = absoluteUploadPath(attachment.url);
            return abs ? removeFileSafe(abs) : Promise.resolve();
          })
        );
        res.status(500).json({ message: "Unable to publish post" });
      }
    });
  });

  app.delete("/api/posts/:id", authenticate, async (req, res) => {
    const postId = req.params.id;
    if (!postId) {
      return res.status(400).json({ message: "Post id required" });
    }
    try {
      const posts = await listUserPosts(req.user.username);
      const target = posts.find((post) => post.id === postId);
      if (!target) {
        return res.status(404).json({ message: "Post not found" });
      }
      await deleteUserPost(req.user.username, postId);
      if (Array.isArray(target.attachments)) {
        await Promise.all(
          target.attachments.map(async (attachment) => {
            const abs = absoluteUploadPath(attachment.url);
            if (abs) {
              await removeFileSafe(abs);
            }
          })
        );
      }
      res.status(204).end();
    } catch (error) {
      console.error("Failed to delete post", error);
      res.status(500).json({ message: "Unable to delete post" });
    }
  });

  app.use((err, req, res, next) => {
    console.error("Unhandled error", err);
    res.status(500).json({ message: "Unexpected server error" });
  });

  return app;
}

module.exports = { createApp, HAS_UPSTASH_CONFIG };
