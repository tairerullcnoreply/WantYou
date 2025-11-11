const path = require("path");
const os = require("os");
const fs = require("fs");
const fsp = require("fs/promises");
const crypto = require("crypto");
const { EventEmitter } = require("events");
const express = require("express");
const multer = require("multer");
const aiPreview = require("./aiPreviewData");

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

const USERNAME_CHANGE_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const DEFAULT_USER_SETTINGS = Object.freeze({
  disabled: false,
  messagesEnabled: true,
  discoverable: true,
  readReceiptsEnabled: true,
  disabledAt: null,
});

const STREAK_WINDOW_HOURS = 36;
const STREAK_WINDOW_MS = STREAK_WINDOW_HOURS * 60 * 60 * 1000;
const DEFAULT_STREAK_STATE = Object.freeze({
  length: 0,
  best: 0,
  activeSince: null,
  lastExchangeAt: null,
  awaiting: null,
  lastMessageAt: null,
});

const MAX_MEDIA_FILE_SIZE = 100 * 1024 * 1024; // 100 MB per GitHub upload limit
const PROJECT_ROOT = path.resolve(__dirname, "..");

const dataChangeEmitter = new EventEmitter();
dataChangeEmitter.setMaxListeners(0);

let dataChangeVersion = 0;
let lastDataChangeSnapshot = {
  type: "data-changed",
  version: 0,
  timestamp: new Date().toISOString(),
  mutations: [],
};

const MUTATING_COMMANDS = new Set([
  "SET",
  "DEL",
  "HSET",
  "HDEL",
  "LPUSH",
  "RPUSH",
  "LREM",
  "LTRIM",
  "ZADD",
  "ZREM",
]);

function isMutatingCommandName(name) {
  if (!name) return false;
  return MUTATING_COMMANDS.has(String(name).toUpperCase());
}

function describeMutation(command) {
  if (!Array.isArray(command) || command.length === 0) {
    return null;
  }
  const [name, keyCandidate] = command;
  if (!isMutatingCommandName(name)) {
    return null;
  }
  const mutation = {
    command: String(name).toUpperCase(),
  };
  if (typeof keyCandidate === "string" && keyCandidate.trim()) {
    mutation.key = keyCandidate;
  }
  return mutation;
}

function publishDataChange(commands) {
  if (!Array.isArray(commands) || commands.length === 0) {
    return;
  }
  const seen = new Set();
  const mutations = commands
    .map((command) => describeMutation(command))
    .filter(Boolean)
    .filter((mutation) => {
      const identifier = `${mutation.command}:${mutation.key ?? ""}`;
      if (seen.has(identifier)) {
        return false;
      }
      seen.add(identifier);
      return true;
    });
  if (!mutations.length) {
    return;
  }
  dataChangeVersion += 1;
  lastDataChangeSnapshot = {
    type: "data-changed",
    version: dataChangeVersion,
    timestamp: new Date().toISOString(),
    mutations,
  };
  try {
    dataChangeEmitter.emit("data", JSON.stringify(lastDataChangeSnapshot));
  } catch (error) {
    console.warn("Unable to publish realtime update", error);
  }
}

function latestDataChangeSnapshot() {
  return lastDataChangeSnapshot;
}

const EVENT_DURATION_OPTIONS = new Set([6, 12, 24, 48]);
const EVENT_ACCENTS = new Set(["sunrise", "ocean", "violet", "forest"]);
const DEFAULT_EVENT_DURATION_HOURS = 24;
const DEFAULT_EVENT_ACCENT = "sunrise";

const VALID_POST_VISIBILITIES = new Set(["public", "connections", "private"]);
const DEFAULT_POST_VISIBILITY = "public";
const VALID_POST_MOODS = new Set([
  "none",
  "celebration",
  "question",
  "memory",
  "announcement",
]);
const DEFAULT_POST_MOOD = "none";

const MAX_POST_COMMENT_LENGTH = 350;
const MAX_STORED_POST_COMMENTS = 100;
const POST_COMMENT_RESPONSE_LIMIT = 20;

const RELATIONSHIP_STATUS = Object.freeze({
  SINGLE: "single",
  DATING_OPEN: "dating-open",
  DATING: "dating",
  NOT_LOOKING: "not-looking",
  OPEN: "open",
});

const RELATIONSHIP_STATUS_LABELS = Object.freeze({
  [RELATIONSHIP_STATUS.SINGLE]: "Single",
  [RELATIONSHIP_STATUS.DATING_OPEN]: "Dating but Open",
  [RELATIONSHIP_STATUS.DATING]: "Dating",
  [RELATIONSHIP_STATUS.NOT_LOOKING]: "Not Looking",
  [RELATIONSHIP_STATUS.OPEN]: "Open to New Connections",
});

const RELATIONSHIP_STATUS_OPTIONS = new Set(Object.values(RELATIONSHIP_STATUS));
const DEFAULT_RELATIONSHIP_STATUS = RELATIONSHIP_STATUS.OPEN;

const MINIMUM_VERIFIED_AGE = 13;
const MAXIMUM_VERIFIED_AGE = 120;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeBirthdateInput(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  let isoCandidate = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    isoCandidate = trimmed;
  } else {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    isoCandidate = parsed.toISOString().slice(0, 10);
  }
  const [yearStr, monthStr, dayStr] = isoCandidate.split("-");
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  if (
    [year, month, day].some((part) => !Number.isFinite(part)) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }
  if (candidate.getUTCDate() !== day || candidate.getUTCMonth() + 1 !== month) {
    return null;
  }
  const now = new Date();
  if (candidate > now) {
    return null;
  }
  const earliest = new Date(Date.UTC(now.getUTCFullYear() - MAXIMUM_VERIFIED_AGE, now.getUTCMonth(), now.getUTCDate()));
  if (candidate < earliest) {
    return null;
  }
  const iso = candidate.toISOString().slice(0, 10);
  const age = calculateAgeFromIso(iso, now);
  if (age === null || age < MINIMUM_VERIFIED_AGE) {
    return null;
  }
  return iso;
}

function calculateAgeFromIso(iso, referenceDate = new Date()) {
  if (typeof iso !== "string" || !iso) {
    return null;
  }
  const [yearStr, monthStr, dayStr] = iso.split("-");
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  if (
    [year, month, day].some((part) => !Number.isFinite(part)) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  let age = referenceDate.getUTCFullYear() - year;
  const monthDiff = referenceDate.getUTCMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getUTCDate() < day)) {
    age -= 1;
  }
  if (age < 0) {
    return null;
  }
  return age;
}

function determineAgeRange(iso) {
  const age = calculateAgeFromIso(iso);
  if (age === null) {
    return null;
  }
  if (age < MINIMUM_VERIFIED_AGE) {
    return null;
  }
  if (age <= 17) {
    return "13-17";
  }
  if (age <= 20) {
    return "18-20";
  }
  if (age <= 24) {
    return "21-24";
  }
  if (age <= 29) {
    return "25-29";
  }
  if (age <= 34) {
    return "30-34";
  }
  if (age <= 39) {
    return "35-39";
  }
  if (age <= 49) {
    return "40-49";
  }
  if (age <= 64) {
    return "50-64";
  }
  return "65+";
}

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
const USE_EPHEMERAL_UPLOADS = UPLOAD_ROOT.startsWith(os.tmpdir());
const USE_KV_MEDIA_STORAGE = USE_EPHEMERAL_UPLOADS && HAS_UPSTASH_CONFIG;

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

function sanitizeText(input, maxLength) {
  if (typeof input !== "string") {
    return "";
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }
  if (!Number.isFinite(maxLength) || maxLength <= 0) {
    return trimmed;
  }
  return trimmed.slice(0, maxLength);
}

function normalizeRelationshipStatus(value) {
  if (typeof value !== "string") {
    return DEFAULT_RELATIONSHIP_STATUS;
  }
  const normalized = value.trim().toLowerCase();
  if (RELATIONSHIP_STATUS_OPTIONS.has(normalized)) {
    return normalized;
  }
  switch (normalized) {
    case "looking":
    case "open":
      return RELATIONSHIP_STATUS.OPEN;
    case "focused":
    case "away":
    case "busy":
      return RELATIONSHIP_STATUS.NOT_LOOKING;
    default:
      return DEFAULT_RELATIONSHIP_STATUS;
  }
}

function getRelationshipStatusLabel(value) {
  const normalized = normalizeRelationshipStatus(value);
  return (
    RELATIONSHIP_STATUS_LABELS[normalized] ?? RELATIONSHIP_STATUS_LABELS[DEFAULT_RELATIONSHIP_STATUS]
  );
}

function sanitizeWebsite(input) {
  if (typeof input !== "string") {
    return "";
  }
  let trimmed = input.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length > 200) {
    trimmed = trimmed.slice(0, 200);
  }
  try {
    let candidate = trimmed;
    if (!/^https?:\/\//i.test(candidate)) {
      candidate = `https://${candidate}`;
    }
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    parsed.hash = "";
    return parsed.toString();
  } catch (error) {
    return "";
  }
}

function sanitizeInterestList(value) {
  let rawItems = [];
  if (Array.isArray(value)) {
    rawItems = value;
  } else if (typeof value === "string") {
    rawItems = value.split(/[\n,]/);
  }
  const interests = [];
  const seen = new Set();
  rawItems.forEach((item) => {
    const sanitized = sanitizeText(item, 40);
    if (!sanitized) return;
    const key = sanitized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    interests.push(sanitized);
  });
  return interests.slice(0, 8);
}

function sanitizeLinkEntries(value) {
  let entries = [];
  if (Array.isArray(value)) {
    entries = value;
  } else if (typeof value === "string") {
    entries = value
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        const [labelPart, urlPart] = trimmed.split(/\s+-\s+|\s+\|\s+/, 2);
        if (urlPart) {
          return { label: labelPart, url: urlPart };
        }
        return { label: "", url: trimmed };
      })
      .filter(Boolean);
  }
  const links = [];
  const seen = new Set();
  entries.forEach((entry) => {
    if (!entry) return;
    const url = sanitizeWebsite(entry.url ?? "");
    if (!url || seen.has(url)) {
      return;
    }
    seen.add(url);
    const label = sanitizeText(entry.label ?? "", 60) || url;
    links.push({ label, url });
  });
  return links.slice(0, 5);
}

function normalizeUserSettings(settings) {
  const normalized = { ...DEFAULT_USER_SETTINGS };
  if (settings && typeof settings === "object") {
    if (typeof settings.disabled === "boolean") {
      normalized.disabled = settings.disabled;
    }
    if (typeof settings.messagesEnabled === "boolean") {
      normalized.messagesEnabled = settings.messagesEnabled;
    }
    if (typeof settings.discoverable === "boolean") {
      normalized.discoverable = settings.discoverable;
    }
    if (typeof settings.readReceiptsEnabled === "boolean") {
      normalized.readReceiptsEnabled = settings.readReceiptsEnabled;
    }
    if (typeof settings.disabledAt === "string" && settings.disabledAt.trim()) {
      const parsed = new Date(settings.disabledAt);
      if (!Number.isNaN(parsed.getTime())) {
        normalized.disabledAt = parsed.toISOString();
      }
    }
  }
  if (!normalized.disabled) {
    normalized.disabledAt = null;
  } else if (!normalized.disabledAt) {
    normalized.disabledAt = new Date().toISOString();
  }
  return normalized;
}

function sanitizeUserRecord(record) {
  if (!record || !record.username) {
    throw new Error("User record must include a username");
  }
  const userId = typeof record.userId === "string" && record.userId.trim().length ? record.userId.trim() : null;
  if (!userId) {
    throw new Error("User record must include a userId");
  }
  const history = Array.isArray(record.usernameHistory)
    ? record.usernameHistory
        .map((entry) => {
          if (!entry) return null;
          const username = normalizeUsername(entry.username);
          if (!username || username === normalizeUsername(record.username)) {
            return null;
          }
          return {
            username,
            changedAt: entry.changedAt ?? null,
          };
        })
        .filter(Boolean)
    : [];
  const birthdate = normalizeBirthdateInput(record.birthdate);
  return {
    userId,
    fullName: typeof record.fullName === "string" ? record.fullName.trim() : "",
    username: normalizeUsername(record.username),
    passwordHash: record.passwordHash,
    tagline: typeof record.tagline === "string" ? record.tagline : "",
    bio: typeof record.bio === "string" ? record.bio : "",
    profilePicturePath:
      typeof record.profilePicturePath === "string" ? record.profilePicturePath : "",
    badges: enforceBadgeRules(normalizeUsername(record.username), record.badges),
    usernameHistory: history,
    usernameChangedAt: record.usernameChangedAt ?? null,
    pronouns: sanitizeText(record.pronouns ?? "", 40),
    location: sanitizeText(record.location ?? "", 120),
    relationshipStatus: normalizeRelationshipStatus(
      record.relationshipStatus ?? record.availability ?? DEFAULT_RELATIONSHIP_STATUS
    ),
    sexuality: sanitizeText(record.sexuality ?? "", 60),
    journey: sanitizeText(record.journey ?? "", 600),
    spotlight: sanitizeText(record.spotlight ?? "", 280),
    interests: sanitizeInterestList(record.interests ?? []),
    links: sanitizeLinkEntries(record.links ?? []),
    birthdate,
    ageRange: determineAgeRange(birthdate),
    settings: normalizeUserSettings(record.settings),
  };
}

function buildUserSummaryPayload(user) {
  return JSON.stringify({
    fullName: user.fullName,
    tagline: user.tagline ?? "",
    badges: Array.isArray(user.badges) ? user.badges : [],
    userId: user.userId,
    profilePicturePath: user.profilePicturePath ?? "",
    previousUsernames: Array.isArray(user.usernameHistory)
      ? user.usernameHistory.map((entry) => entry.username)
      : [],
    pronouns: user.pronouns ?? "",
    location: user.location ?? "",
    relationshipStatus: user.relationshipStatus ?? DEFAULT_RELATIONSHIP_STATUS,
    sexuality: user.sexuality ?? "",
    birthdate: user.birthdate ?? null,
    ageRange: user.ageRange ?? null,
    settings: normalizeUserSettings(user.settings),
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
  const mutated = [];
  for (const command of commands) {
    results.push(await memoryCommand(command));
    if (Array.isArray(command) && isMutatingCommandName(command[0])) {
      mutated.push(command);
    }
  }
  if (mutated.length) {
    publishDataChange(mutated);
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
    const results = payload.map((entry) => {
      if (entry.error) {
        throw new Error(entry.error);
      }
      return entry.result ?? null;
    });
    publishDataChange(commands);
    return results;
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

function normalizeStreakState(streak, { lastMessage = null, now = Date.now() } = {}) {
  const safe = { ...DEFAULT_STREAK_STATE };
  if (streak && typeof streak === "object") {
    const length = Number.parseInt(streak.length, 10);
    if (Number.isFinite(length) && length > 0) {
      safe.length = length;
    }
    const best = Number.parseInt(streak.best, 10);
    if (Number.isFinite(best) && best > 0) {
      safe.best = Math.max(best, safe.length);
    }
    ["activeSince", "lastExchangeAt", "lastMessageAt"].forEach((field) => {
      const value = streak[field];
      if (typeof value === "string" && value.trim()) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
          safe[field] = parsed.toISOString();
        }
      }
    });
    if (typeof streak.awaiting === "string") {
      const normalized = normalizeUsername(streak.awaiting);
      safe.awaiting = normalized || null;
    }
  }
  if (lastMessage?.createdAt && !safe.lastMessageAt) {
    const parsed = new Date(lastMessage.createdAt);
    if (!Number.isNaN(parsed.getTime())) {
      safe.lastMessageAt = parsed.toISOString();
    }
  }
  if (safe.lastMessageAt) {
    const lastMessageTime = Date.parse(safe.lastMessageAt);
    if (Number.isNaN(lastMessageTime)) {
      safe.lastMessageAt = null;
    } else if (now - lastMessageTime > STREAK_WINDOW_MS) {
      safe.length = 0;
      safe.activeSince = null;
      safe.lastExchangeAt = null;
      safe.awaiting = null;
    }
  }
  if (safe.activeSince && Number.isNaN(Date.parse(safe.activeSince))) {
    safe.activeSince = null;
  }
  if (safe.lastExchangeAt && Number.isNaN(Date.parse(safe.lastExchangeAt))) {
    safe.lastExchangeAt = null;
  }
  if (safe.best < safe.length) {
    safe.best = safe.length;
  }
  return safe;
}

function advanceConversationStreak(meta, message, sender, recipient) {
  const nowIso = message.createdAt;
  const nowMs = Date.parse(nowIso);
  const previousLastMessage = meta?.lastMessage ?? null;
  const streak = normalizeStreakState(meta?.streak, {
    lastMessage: previousLastMessage,
    now: Number.isFinite(nowMs) ? nowMs : Date.now(),
  });

  const previousSender = normalizeUsername(previousLastMessage?.sender);
  const previousTimeIso = previousLastMessage?.createdAt ?? streak.lastMessageAt;
  const previousTime = previousTimeIso ? Date.parse(previousTimeIso) : NaN;
  const waitingFor = normalizeUsername(recipient);

  streak.lastMessageAt = Number.isFinite(nowMs) ? new Date(nowMs).toISOString() : nowIso ?? null;

  if (!previousSender || !previousTimeIso || Number.isNaN(previousTime)) {
    streak.awaiting = waitingFor;
    if (!streak.activeSince && streak.lastMessageAt) {
      streak.activeSince = streak.lastMessageAt;
    }
    return streak;
  }

  if (previousSender === normalizeUsername(sender)) {
    streak.awaiting = waitingFor;
    if (!streak.activeSince && previousTimeIso) {
      streak.activeSince = previousTimeIso;
    }
    return normalizeStreakState(streak, { lastMessage: { createdAt: streak.lastMessageAt }, now: Number.isFinite(nowMs) ? nowMs : Date.now() });
  }

  if (Number.isFinite(nowMs) && nowMs - previousTime <= STREAK_WINDOW_MS) {
    const nextLength = Math.max(0, streak.length) + 1;
    streak.length = nextLength;
    streak.best = Math.max(streak.best, nextLength);
    if (!streak.activeSince && previousTimeIso) {
      streak.activeSince = previousTimeIso;
    }
    streak.lastExchangeAt = streak.lastMessageAt;
    streak.awaiting = waitingFor;
    return streak;
  }

  streak.length = 0;
  streak.activeSince = streak.lastMessageAt;
  streak.lastExchangeAt = null;
  streak.awaiting = waitingFor;
  return streak;
}

function filterReadReceiptsForViewer(readAt, viewerUsername, otherUsername, otherSettings) {
  const result = {};
  Object.entries(readAt || {}).forEach(([username, iso]) => {
    const normalized = normalizeUsername(username);
    if (!normalized) return;
    if (typeof iso === "string" && iso.trim()) {
      result[normalized] = iso;
    }
  });
  const otherNormalized = normalizeUsername(otherUsername);
  if (otherNormalized && otherSettings && otherSettings.readReceiptsEnabled === false) {
    delete result[otherNormalized];
  }
  return result;
}

function exposeStreak(meta) {
  const normalized = normalizeStreakState(meta?.streak, { lastMessage: meta?.lastMessage });
  return { ...normalized, windowHours: STREAK_WINDOW_HOURS };
}

function upgradeConversationMeta(meta) {
  const safe = {
    lastMessage: null,
    updatedAt: null,
    unread: {},
    readAt: {},
    totalMessages: 0,
  };
  if (!meta || typeof meta !== "object") {
    return safe;
  }

  if (meta.lastMessage && typeof meta.lastMessage === "object") {
    const { id, sender, text, createdAt } = meta.lastMessage;
    if (id && sender && createdAt) {
      safe.lastMessage = {
        id,
        sender,
        text: typeof text === "string" ? text : "",
        createdAt,
      };
    }
  }

  if (meta.updatedAt) {
    safe.updatedAt = meta.updatedAt;
  }

  const rawCount = Number(meta.totalMessages ?? meta.messageCount ?? 0);
  if (Number.isFinite(rawCount) && rawCount >= 0) {
    safe.totalMessages = Math.floor(rawCount);
  }

  if (meta.unread && typeof meta.unread === "object") {
    Object.entries(meta.unread).forEach(([username, count]) => {
      const normalized = normalizeUsername(username);
      if (!normalized) return;
      const numeric = Number(count);
      safe.unread[normalized] = Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
    });
  }

  if (meta.readAt && typeof meta.readAt === "object") {
    Object.entries(meta.readAt).forEach(([username, iso]) => {
      const normalized = normalizeUsername(username);
      if (!normalized) return;
      if (typeof iso === "string" && iso.trim()) {
        safe.readAt[normalized] = iso;
      }
    });
  }

  if (Array.isArray(meta.participants)) {
    safe.participants = meta.participants
      .map((username) => normalizeUsername(username))
      .filter(Boolean);
  }

  safe.streak = normalizeStreakState(meta.streak, { lastMessage: safe.lastMessage });

  return safe;
}

async function getConversationMeta(usernameA, usernameB) {
  const id = conversationId(usernameA, usernameB);
  if (!id) return null;
  const raw = await redisCommand(["GET", conversationMetaKey(id)]);
  if (!raw) return null;
  return upgradeConversationMeta(parseJsonSafe(raw, null));
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

function mediaKey(id) {
  return `media:${id}`;
}

function decodeMediaLocation(location) {
  if (!location) return null;
  if (location.startsWith("kv://")) {
    return { storage: "kv", id: location.slice("kv://".length) };
  }
  if (location.startsWith("data:")) {
    return { storage: "inline", path: location };
  }
  return { storage: "disk", path: location };
}

function resolveMediaUrl(location) {
  if (!location) return "";
  if (location.startsWith("kv://")) {
    return `/api/media/${location.slice("kv://".length)}`;
  }
  return location;
}

function buildDataUrl(mimeType, buffer) {
  const safeMime = typeof mimeType === "string" && mimeType ? mimeType : "application/octet-stream";
  return `data:${safeMime};base64,${buffer.toString("base64")}`;
}

async function persistMediaFile(file) {
  if (!file) return null;
  const readBuffer = async () => {
    const content = await fsp.readFile(file.path);
    return content;
  };
  if (USE_KV_MEDIA_STORAGE) {
    const id = crypto.randomUUID();
    const buffer = await readBuffer();
    const payload = {
      mimeType: file.mimetype,
      data: buffer.toString("base64"),
    };
    await redisCommand(["SET", mediaKey(id), JSON.stringify(payload)]);
    await removeFileSafe(file.path);
    return {
      location: `kv://${id}`,
      mimeType: file.mimetype,
      size: buffer.length,
    };
  }
  if (!USE_EPHEMERAL_UPLOADS) {
    const location = relativeUploadPath(file.path);
    if (location) {
      return {
        location,
        mimeType: file.mimetype,
        size: file.size ?? 0,
      };
    }
  }
  const buffer = await readBuffer();
  await removeFileSafe(file.path);
  return {
    location: buildDataUrl(file.mimetype, buffer),
    mimeType: file.mimetype,
    size: buffer.length,
  };
}

async function describeAttachment(file) {
  if (!file) return null;
  const base = await persistMediaFile(file);
  if (!base?.location) {
    await removeFileSafe(file.path);
    return null;
  }
  const type = ALLOWED_VIDEO_TYPES.has(file.mimetype) ? "video" : "image";
  return {
    id: crypto.randomUUID(),
    type,
    location: base.location,
    originalName: file.originalname ?? "",
    size: base.size,
    mimeType: base.mimeType,
  };
}

function absoluteUploadPath(relativePath) {
  if (!relativePath) return null;
  if (relativePath.startsWith("kv://")) {
    return null;
  }
  const normalized = relativePath.startsWith("/")
    ? relativePath.slice(1)
    : relativePath;
  if (normalized.startsWith("uploads/")) {
    return path.resolve(UPLOAD_ROOT, normalized.slice("uploads/".length));
  }
  return path.resolve(PROJECT_ROOT, normalized);
}

async function removeMediaLocation(location) {
  if (!location) return;
  const decoded = decodeMediaLocation(location);
  if (!decoded) return;
  if (decoded.storage === "inline") {
    return;
  }
  if (decoded.storage === "kv") {
    await redisCommand(["DEL", mediaKey(decoded.id)]);
    return;
  }
  const absolute = absoluteUploadPath(decoded.path);
  if (absolute) {
    await removeFileSafe(absolute);
  }
}

async function cleanupAttachments(attachments) {
  if (!Array.isArray(attachments) || !attachments.length) {
    return;
  }
  await Promise.all(
    attachments.map((attachment) =>
      removeMediaLocation(attachment?.location ?? attachment?.url ?? null)
    )
  );
}

async function getUser(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  const raw = await redisCommand(["GET", userKey(normalized)]);
  if (!raw) return null;
  const record = parseJsonSafe(raw, null);
  if (!record) return null;
  const nextRecord = { ...record, username: record.username ?? normalized };
  let requiresUpdate = false;
  if (!nextRecord.userId) {
    nextRecord.userId = crypto.randomUUID();
    requiresUpdate = true;
  }
  if (!Array.isArray(nextRecord.usernameHistory)) {
    nextRecord.usernameHistory = [];
    requiresUpdate = true;
  }
  if (typeof nextRecord.usernameChangedAt !== "string" && nextRecord.usernameChangedAt !== null) {
    nextRecord.usernameChangedAt = null;
    requiresUpdate = true;
  }
  const sanitized = sanitizeUserRecord(nextRecord);
  if (requiresUpdate) {
    await writeUserRecord({ ...sanitized, passwordHash: record.passwordHash });
  }
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
    userId: crypto.randomUUID(),
    usernameHistory: [],
    usernameChangedAt: null,
    pronouns: "",
    location: "",
    relationshipStatus: DEFAULT_RELATIONSHIP_STATUS,
    sexuality: "",
    journey: "",
    spotlight: "",
    interests: [],
    links: [],
    birthdate: null,
    ageRange: null,
    settings: { ...DEFAULT_USER_SETTINGS },
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

function buildUsernameHistory(currentHistory, oldUsername, changedAt) {
  const history = Array.isArray(currentHistory) ? currentHistory.slice() : [];
  const normalizedOld = normalizeUsername(oldUsername);
  if (!normalizedOld) {
    return history;
  }
  history.unshift({ username: normalizedOld, changedAt });
  const seen = new Set();
  return history.filter((entry) => {
    if (!entry?.username || seen.has(entry.username)) {
      return false;
    }
    seen.add(entry.username);
    return true;
  });
}

async function migrateConversationRecords(oldUsername, newUsername, allUsernames) {
  const others = allUsernames.filter((username) => username !== newUsername);
  await Promise.all(
    others.map(async (otherUsername) => {
      const oldId = conversationId(oldUsername, otherUsername);
      const newId = conversationId(newUsername, otherUsername);
      if (!oldId || !newId || oldId === newId) {
        return;
      }
      const { messages } = await getConversationMessages(oldUsername, otherUsername);
      if (messages.length) {
        const updatedMessages = messages.map((message) => {
          if (message?.sender === oldUsername) {
            return { ...message, sender: newUsername };
          }
          return message;
        });
        await rewriteList(conversationMessagesKey(newId), updatedMessages);
      } else {
        await redisPipeline([["DEL", conversationMessagesKey(newId)]]);
      }
      await redisCommand(["DEL", conversationMessagesKey(oldId)]);

      const rawMeta = await redisCommand(["GET", conversationMetaKey(oldId)]);
      if (rawMeta) {
        const parsedMeta = upgradeConversationMeta(parseJsonSafe(rawMeta, null));
        if (parsedMeta?.lastMessage?.sender === oldUsername) {
          parsedMeta.lastMessage = { ...parsedMeta.lastMessage, sender: newUsername };
        }
        if (parsedMeta?.unread) {
          parsedMeta.unread = Object.fromEntries(
            Object.entries(parsedMeta.unread).map(([username, count]) => {
              const normalized = username === oldUsername ? newUsername : username;
              return [normalized, count];
            })
          );
        }
        if (parsedMeta?.readAt) {
          parsedMeta.readAt = Object.fromEntries(
            Object.entries(parsedMeta.readAt).map(([username, iso]) => {
              const normalized = username === oldUsername ? newUsername : username;
              return [normalized, iso];
            })
          );
        }
        parsedMeta.participants = (parsedMeta.participants || []).map((username) =>
          username === oldUsername ? newUsername : username
        );
        parsedMeta.messageCount = parsedMeta.totalMessages;
        await redisPipeline([
          ["SET", conversationMetaKey(newId), JSON.stringify(parsedMeta ?? {})],
          ["DEL", conversationMetaKey(oldId)],
        ]);
      } else {
        await redisCommand(["DEL", conversationMetaKey(oldId)]);
      }
    })
  );
}

async function migrateSelectedThreads(oldUsername, newUsername, usernames) {
  await Promise.all(
    usernames.map(async (username) => {
      const thread = await getSelectedThread(username);
      if (!thread) return;
      const normalizedThreadId = normalizeUsername(thread.threadId);
      const normalizedPerson = normalizeUsername(thread.person);
      let changed = false;
      const updatedThread = { ...thread };
      if (normalizedThreadId === oldUsername) {
        updatedThread.threadId = newUsername;
        changed = true;
      }
      if (normalizedPerson === oldUsername) {
        updatedThread.person = newUsername;
        changed = true;
      }
      if (changed) {
        await saveSelectedThread(username, updatedThread);
      }
    })
  );
}

async function migrateUserAssociations(oldUsername, newUsername) {
  const [outgoing, incoming] = await Promise.all([
    getOutgoingConnections(oldUsername),
    getIncomingConnections(oldUsername),
  ]);
  if (Object.keys(outgoing).length) {
    await writeConnectionMap(outgoingConnectionsKey(newUsername), outgoing);
  } else {
    await redisCommand(["DEL", outgoingConnectionsKey(newUsername)]);
  }
  if (Object.keys(incoming).length) {
    await writeConnectionMap(incomingConnectionsKey(newUsername), incoming);
  } else {
    await redisCommand(["DEL", incomingConnectionsKey(newUsername)]);
  }
  await redisPipeline([
    ["DEL", outgoingConnectionsKey(oldUsername)],
    ["DEL", incomingConnectionsKey(oldUsername)],
  ]);

  const storedThread = await getSelectedThread(oldUsername);
  if (storedThread) {
    const updatedThread = { ...storedThread };
    if (normalizeUsername(updatedThread.threadId) === oldUsername) {
      updatedThread.threadId = newUsername;
    }
    if (normalizeUsername(updatedThread.person) === oldUsername) {
      updatedThread.person = newUsername;
    }
    await saveSelectedThread(newUsername, updatedThread);
  }
  await redisCommand(["DEL", selectedThreadKey(oldUsername)]);

  const users = await listUsers({ includeHidden: true });
  const usernames = users.map((entry) => entry.username);
  await Promise.all(
    users.map(async (entry) => {
      const username = entry.username;
      if (username === newUsername) return;
      const [otherOutgoing, otherIncoming] = await Promise.all([
        getOutgoingConnections(username),
        getIncomingConnections(username),
      ]);
      let outgoingChanged = false;
      if (otherOutgoing[oldUsername]) {
        otherOutgoing[newUsername] = otherOutgoing[oldUsername];
        delete otherOutgoing[oldUsername];
        outgoingChanged = true;
      }
      if (outgoingChanged) {
        await writeConnectionMap(outgoingConnectionsKey(username), otherOutgoing);
      }
      let incomingChanged = false;
      if (otherIncoming[oldUsername]) {
        otherIncoming[newUsername] = otherIncoming[oldUsername];
        delete otherIncoming[oldUsername];
        incomingChanged = true;
      }
      if (incomingChanged) {
        await writeConnectionMap(incomingConnectionsKey(username), otherIncoming);
      }
    })
  );

  const events = await listUserEvents(oldUsername);
  if (events.length) {
    await rewriteList(userEventsKey(newUsername), events);
  } else {
    await redisCommand(["DEL", userEventsKey(newUsername)]);
  }
  await redisCommand(["DEL", userEventsKey(oldUsername)]);

  const posts = await listUserPosts(oldUsername);
  if (posts.length) {
    await rewriteList(userPostsKey(newUsername), posts);
  } else {
    await redisCommand(["DEL", userPostsKey(newUsername)]);
  }
  await redisCommand(["DEL", userPostsKey(oldUsername)]);

  await migrateConversationRecords(oldUsername, newUsername, usernames);
  await migrateSelectedThreads(oldUsername, newUsername, usernames);
}

async function renameUserAccount(user, newUsername, updates = {}, options = {}) {
  const { preserveHistory = false } = options ?? {};
  const oldUsername = user.username;
  const normalizedNew = normalizeUsername(newUsername);
  if (!normalizedNew) {
    throw new Error("A valid new username is required");
  }
  const changedAt = new Date().toISOString();
  const usernameHistory = preserveHistory
    ? Array.isArray(user.usernameHistory)
      ? user.usernameHistory.slice()
      : []
    : buildUsernameHistory(user.usernameHistory, oldUsername, changedAt);
  const record = {
    ...user,
    ...updates,
    username: normalizedNew,
    usernameHistory,
    usernameChangedAt: changedAt,
  };
  const saved = await writeUserRecord(record);
  await redisPipeline([
    ["DEL", userKey(oldUsername)],
    ["HDEL", "users", oldUsername],
  ]);
  await migrateUserAssociations(oldUsername, normalizedNew);
  return { ...saved, passwordHash: user.passwordHash };
}

async function listUsers(options = {}) {
  const { includeHidden = false } = options;
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
      const settings = normalizeUserSettings(parsed.settings);
      if (!includeHidden && (settings.disabled || settings.discoverable === false)) {
        continue;
      }
      let profilePicturePath =
        typeof parsed.profilePicturePath === "string" ? parsed.profilePicturePath : "";
      if (!profilePicturePath) {
        const fullRecord = await getUser(username);
        profilePicturePath = fullRecord?.profilePicturePath ?? "";
      }
      const ageRange = parsed.ageRange ?? determineAgeRange(parsed.birthdate);
      users.push({
        username,
        fullName: parsed.fullName,
        tagline: parsed.tagline ?? "",
        badges: enforceBadgeRules(username, parsed.badges),
        userId: parsed.userId ?? null,
        profilePicturePath,
        previousUsernames: Array.isArray(parsed.previousUsernames)
          ? parsed.previousUsernames.filter(Boolean)
          : [],
        ageRange: ageRange ?? null,
        settings,
      });
    } else {
      const fallbackSettings = { ...DEFAULT_USER_SETTINGS };
      if (!includeHidden && (fallbackSettings.disabled || fallbackSettings.discoverable === false)) {
        continue;
      }
      users.push({
        username,
        fullName: raw,
        tagline: "",
        badges: [],
        userId: null,
        profilePicturePath: "",
        previousUsernames: [],
        ageRange: null,
        settings: fallbackSettings,
      });
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

async function writeConnectionMap(key, map) {
  const commands = [["DEL", key]];
  Object.entries(map || {}).forEach(([username, state]) => {
    if (!username) return;
    commands.push(["HSET", key, username, JSON.stringify(buildConnectionState(state))]);
  });
  await redisPipeline(commands);
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

async function applyOutgoingConnectionMap(username, map = {}) {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername || !isPlainObject(map)) {
    return;
  }
  const current = await getOutgoingConnections(normalizedUsername);
  const desiredEntries = Object.entries(map);
  const retained = new Set();
  for (const [targetUsername, state] of desiredEntries) {
    const normalizedTarget = normalizeUsername(targetUsername);
    if (!normalizedTarget || normalizedTarget === normalizedUsername) {
      continue;
    }
    retained.add(normalizedTarget);
    const nextState = buildConnectionState(state);
    await saveConnection(normalizedUsername, normalizedTarget, nextState);
  }
  for (const existingTarget of Object.keys(current)) {
    if (!retained.has(existingTarget)) {
      await saveConnection(normalizedUsername, existingTarget, { status: "none" });
    }
  }
}

async function applyIncomingConnectionMap(username, map = {}) {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername || !isPlainObject(map)) {
    return;
  }
  const current = await getIncomingConnections(normalizedUsername);
  const desiredEntries = Object.entries(map);
  const retained = new Set();
  for (const [sourceUsername, state] of desiredEntries) {
    const normalizedSource = normalizeUsername(sourceUsername);
    if (!normalizedSource || normalizedSource === normalizedUsername) {
      continue;
    }
    retained.add(normalizedSource);
    const nextState = buildConnectionState(state);
    await saveConnection(normalizedSource, normalizedUsername, nextState);
  }
  for (const existingSource of Object.keys(current)) {
    if (!retained.has(existingSource)) {
      await saveConnection(existingSource, normalizedUsername, { status: "none" });
    }
  }
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

async function deleteUserAccount(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) {
    return null;
  }
  const user = await getUser(normalized);
  if (!user) {
    return null;
  }
  const [events, posts] = await Promise.all([
    listUserEvents(normalized),
    listUserPosts(normalized),
  ]);
  const eventAttachments = events.flatMap((event) => event.attachments ?? []);
  const postAttachments = posts.flatMap((post) => post.attachments ?? []);
  await Promise.all([
    cleanupAttachments(eventAttachments),
    cleanupAttachments(postAttachments),
    user.profilePicturePath ? removeMediaLocation(user.profilePicturePath) : Promise.resolve(),
  ]);

  const otherUsers = await listUsers({ includeHidden: true });
  await Promise.all(
    otherUsers
      .filter((entry) => entry.username !== normalized)
      .map(async (entry) => {
        const other = entry.username;
        const [otherOutgoing, otherIncoming] = await Promise.all([
          getOutgoingConnections(other),
          getIncomingConnections(other),
        ]);
        let outgoingChanged = false;
        if (otherOutgoing[normalized]) {
          delete otherOutgoing[normalized];
          outgoingChanged = true;
        }
        if (outgoingChanged) {
          await writeConnectionMap(outgoingConnectionsKey(other), otherOutgoing);
        }
        let incomingChanged = false;
        if (otherIncoming[normalized]) {
          delete otherIncoming[normalized];
          incomingChanged = true;
        }
        if (incomingChanged) {
          await writeConnectionMap(incomingConnectionsKey(other), otherIncoming);
        }
        const convoId = conversationId(normalized, other);
        if (convoId) {
          await redisPipeline([
            ["DEL", conversationMessagesKey(convoId)],
            ["DEL", conversationMetaKey(convoId)],
          ]);
        }
      })
  );

  await redisPipeline([
    ["DEL", outgoingConnectionsKey(normalized)],
    ["DEL", incomingConnectionsKey(normalized)],
    ["DEL", selectedThreadKey(normalized)],
    ["DEL", userEventsKey(normalized)],
    ["DEL", userPostsKey(normalized)],
    ["DEL", userKey(normalized)],
    ["HDEL", "users", normalized],
  ]);

  return user;
}

async function getLookupPeople(currentUsername, options = {}) {
  const { includeHidden = false } = options;
  const [users, incoming, outgoing] = await Promise.all([
    listUsers({ includeHidden }),
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
      userId: user.userId ?? null,
      profilePicture: user.profilePicturePath
        ? resolveMediaUrl(user.profilePicturePath)
        : "",
      previousUsernames: Array.isArray(user.previousUsernames)
        ? user.previousUsernames.filter(Boolean)
        : [],
      ageRange: user.ageRange ?? null,
      inbound: connectionStateFor(user.username, incoming),
      outbound: connectionStateFor(user.username, outgoing),
      settings: normalizeUserSettings(user.settings),
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

async function getConversationMessages(usernameA, usernameB, options = {}) {
  const { cursor, limit } = options;
  const id = conversationId(usernameA, usernameB);
  if (!id) {
    return { messages: [], hasMore: false, previousCursor: null, total: 0 };
  }
  const rawMessages = await redisCommand(["LRANGE", conversationMessagesKey(id), "0", "-1"]);
  if (!Array.isArray(rawMessages)) {
    return { messages: [], hasMore: false, previousCursor: null, total: 0 };
  }
  const parsed = rawMessages
    .map((entry) => parseJsonSafe(entry, null))
    .filter(Boolean)
    .sort((a, b) => timestampScore(a?.createdAt) - timestampScore(b?.createdAt));

  let filtered = parsed;
  const cursorTime = cursor ? timestampScore(cursor) : null;
  if (cursorTime) {
    filtered = parsed.filter((message) => timestampScore(message?.createdAt) < cursorTime);
  }

  let selected = filtered;
  let hasMore = false;
  if (Number.isFinite(limit) && limit > 0 && filtered.length > limit) {
    hasMore = true;
    selected = filtered.slice(filtered.length - limit);
  }

  const previousCursor = hasMore && selected.length ? selected[0].createdAt ?? null : null;

  return {
    messages: selected,
    hasMore,
    previousCursor,
    total: parsed.length,
  };
}

async function appendConversationMessage(from, to, text) {
  const id = conversationId(from, to);
  if (!id) {
    throw new Error("Conversation participants are required");
  }
  const sender = normalizeUsername(from);
  const recipient = normalizeUsername(to);
  const existingMeta = upgradeConversationMeta(
    parseJsonSafe(await redisCommand(["GET", conversationMetaKey(id)]), null)
  );
  const message = {
    id: crypto.randomUUID(),
    sender,
    text,
    createdAt: new Date().toISOString(),
  };
  const unread = { ...existingMeta.unread };
  if (sender) {
    unread[sender] = 0;
  }
  if (recipient) {
    unread[recipient] = Math.max(0, (unread[recipient] ?? 0) + 1);
  }
  const readAt = { ...existingMeta.readAt };
  if (sender) {
    readAt[sender] = message.createdAt;
  }
  const streak = advanceConversationStreak(existingMeta, message, sender, recipient);
  const meta = {
    lastMessage: message,
    updatedAt: message.createdAt,
    unread,
    readAt,
    totalMessages: existingMeta.totalMessages + 1,
  };
  if (existingMeta.participants?.length) {
    meta.participants = existingMeta.participants;
  } else {
    meta.participants = [sender, recipient].filter(Boolean);
  }
  meta.streak = normalizeStreakState(streak, { lastMessage: message });
  meta.messageCount = meta.totalMessages;
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
    meta.set(person.username, upgradeConversationMeta(parseJsonSafe(raw, null)));
  });
  return meta;
}

async function markConversationRead(usernameA, usernameB) {
  const id = conversationId(usernameA, usernameB);
  if (!id) return null;
  const raw = await redisCommand(["GET", conversationMetaKey(id)]);
  if (!raw) {
    return null;
  }
  const meta = upgradeConversationMeta(parseJsonSafe(raw, null));
  const currentUser = normalizeUsername(usernameA);
  if (currentUser) {
    meta.unread[currentUser] = 0;
    meta.readAt[currentUser] = new Date().toISOString();
  }
  meta.messageCount = meta.totalMessages;
  await redisCommand(["SET", conversationMetaKey(id), JSON.stringify(meta)]);
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

async function rewriteListRaw(key, values) {
  const commands = [["DEL", key]];
  values.forEach((value) => {
    commands.push(["RPUSH", key, value]);
  });
  await redisPipeline(commands);
}

async function moveStringKey(oldKey, newKey) {
  if (oldKey === newKey) {
    return;
  }
  const raw = await redisCommand(["GET", oldKey]);
  if (raw !== null && raw !== undefined) {
    await redisPipeline([
      ["SET", newKey, raw],
      ["DEL", oldKey],
    ]);
  } else {
    await redisCommand(["DEL", oldKey]);
  }
}

function sortByNewest(records) {
  return records.slice().sort((a, b) => {
    const scoreA = timestampScore(a?.createdAt);
    const scoreB = timestampScore(b?.createdAt);
    return scoreB - scoreA;
  });
}

function normalizeEventDuration(value) {
  const parsed = Number.parseInt(value, 10);
  if (EVENT_DURATION_OPTIONS.has(parsed)) {
    return parsed;
  }
  return DEFAULT_EVENT_DURATION_HOURS;
}

function normalizeEventAccent(accent) {
  if (typeof accent !== "string") {
    return DEFAULT_EVENT_ACCENT;
  }
  const trimmed = accent.trim().toLowerCase();
  if (EVENT_ACCENTS.has(trimmed)) {
    return trimmed;
  }
  return DEFAULT_EVENT_ACCENT;
}

function normalizePostVisibility(value) {
  if (typeof value !== "string") {
    return DEFAULT_POST_VISIBILITY;
  }
  const normalized = value.trim().toLowerCase();
  if (VALID_POST_VISIBILITIES.has(normalized)) {
    return normalized;
  }
  return DEFAULT_POST_VISIBILITY;
}

function normalizePostMood(value) {
  if (typeof value !== "string") {
    return DEFAULT_POST_MOOD;
  }
  const normalized = value.trim().toLowerCase();
  if (VALID_POST_MOODS.has(normalized)) {
    return normalized;
  }
  return DEFAULT_POST_MOOD;
}

function sanitizeEventRecord(event) {
  if (!event) {
    throw new Error("Event record missing");
  }
  const createdAtRaw = typeof event.createdAt === "string" ? event.createdAt : new Date().toISOString();
  const createdAtTime = Date.parse(createdAtRaw);
  const createdAt = Number.isNaN(createdAtTime) ? new Date().toISOString() : new Date(createdAtTime).toISOString();
  const durationHours = normalizeEventDuration(event.durationHours);
  const expiresSource = typeof event.expiresAt === "string" ? Date.parse(event.expiresAt) : NaN;
  const expiresAt = Number.isNaN(expiresSource)
    ? new Date(Date.parse(createdAt) + durationHours * 60 * 60 * 1000).toISOString()
    : new Date(expiresSource).toISOString();
  return {
    id: event.id ?? crypto.randomUUID(),
    text: typeof event.text === "string" ? event.text.trim() : "",
    attachments: Array.isArray(event.attachments) ? event.attachments : [],
    createdAt,
    expiresAt,
    durationHours,
    accent: normalizeEventAccent(event.accent),
    highlighted: Boolean(event.highlighted),
  };
}

function postSortScore(post) {
  const reference = post?.updatedAt ?? post?.createdAt;
  if (!reference) return 0;
  const parsed = Date.parse(reference);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortPostsForDisplay(posts) {
  return posts.slice().sort((a, b) => postSortScore(b) - postSortScore(a));
}

function sortEventsForDisplay(events) {
  return events
    .slice()
    .sort((a, b) => {
      if (Boolean(a?.highlighted) !== Boolean(b?.highlighted)) {
        return a.highlighted ? -1 : 1;
      }
      return timestampScore(b?.createdAt) - timestampScore(a?.createdAt);
    });
}

function sanitizePostShare(entry) {
  if (!entry) {
    return null;
  }
  const username = normalizeUsername(entry.username);
  if (!username) {
    return null;
  }
  const createdRaw = typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString();
  const createdTime = Date.parse(createdRaw);
  const createdAt = Number.isNaN(createdTime) ? new Date().toISOString() : new Date(createdTime).toISOString();
  return {
    username,
    createdAt,
  };
}

function sanitizePostComment(comment) {
  if (!comment) {
    return null;
  }
  const username = normalizeUsername(comment.username);
  if (!username) {
    return null;
  }
  const text = sanitizeText(comment.text ?? "", MAX_POST_COMMENT_LENGTH);
  if (!text) {
    return null;
  }
  const createdRaw = typeof comment.createdAt === "string" ? comment.createdAt : new Date().toISOString();
  const createdTime = Date.parse(createdRaw);
  const createdAt = Number.isNaN(createdTime) ? new Date().toISOString() : new Date(createdTime).toISOString();
  const fullName = sanitizeText(comment.fullName ?? "", 120);
  const badges = Array.isArray(comment.badges)
    ? comment.badges
        .map((badge) => sanitizeText(badge ?? "", 40))
        .filter((badge) => Boolean(badge))
    : [];
  return {
    id: comment.id && typeof comment.id === "string" ? comment.id : crypto.randomUUID(),
    username,
    fullName,
    text,
    createdAt,
    badges,
  };
}

function sanitizePostInteractions(interactions = {}) {
  const likeSet = new Set();
  const repostSet = new Set();
  if (Array.isArray(interactions.likes)) {
    interactions.likes.forEach((username) => {
      const normalized = normalizeUsername(username);
      if (normalized) {
        likeSet.add(normalized);
      }
    });
  }
  if (Array.isArray(interactions.reposts)) {
    interactions.reposts.forEach((username) => {
      const normalized = normalizeUsername(username);
      if (normalized) {
        repostSet.add(normalized);
      }
    });
  }

  const shares = Array.isArray(interactions.shares)
    ? interactions.shares
        .map((entry) => sanitizePostShare(entry))
        .filter(Boolean)
    : [];
  const shareMap = new Map();
  shares.forEach((share) => {
    shareMap.set(share.username, share);
  });
  const shareList = Array.from(shareMap.values()).sort(
    (a, b) => timestampScore(a.createdAt) - timestampScore(b.createdAt)
  );

  const comments = Array.isArray(interactions.comments)
    ? interactions.comments
        .map((comment) => sanitizePostComment(comment))
        .filter(Boolean)
        .sort((a, b) => timestampScore(a.createdAt) - timestampScore(b.createdAt))
    : [];
  const limitedComments = comments.slice(-MAX_STORED_POST_COMMENTS);

  return {
    likes: Array.from(likeSet.values()).sort(),
    reposts: Array.from(repostSet.values()).sort(),
    shares: shareList,
    comments: limitedComments,
  };
}

function sanitizePostRecord(post) {
  if (!post) {
    throw new Error("Post record missing");
  }
  const createdAtRaw = typeof post.createdAt === "string" ? post.createdAt : new Date().toISOString();
  const createdTime = Date.parse(createdAtRaw);
  const createdAt = Number.isNaN(createdTime) ? new Date().toISOString() : new Date(createdTime).toISOString();
  const updatedRaw = typeof post.updatedAt === "string" ? post.updatedAt : createdAt;
  const updatedTime = Date.parse(updatedRaw);
  const updatedAt = Number.isNaN(updatedTime) ? createdAt : new Date(updatedTime).toISOString();
  return {
    id: post.id ?? crypto.randomUUID(),
    text: typeof post.text === "string" ? post.text.trim() : "",
    attachments: Array.isArray(post.attachments) ? post.attachments : [],
    createdAt,
    updatedAt,
    visibility: normalizePostVisibility(post.visibility),
    mood: normalizePostMood(post.mood),
    interactions: sanitizePostInteractions(post.interactions),
  };
}

function describePostForViewer(post, viewerUsername) {
  const interactions = sanitizePostInteractions(post.interactions);
  const normalizedViewer = normalizeUsername(viewerUsername);
  const likeSet = new Set(interactions.likes);
  const repostSet = new Set(interactions.reposts);
  const shares = interactions.shares.slice();
  const shareCount = shares.length;
  const viewerShared = normalizedViewer
    ? shares.some((share) => share.username === normalizedViewer)
    : false;
  const comments = interactions.comments.slice();
  const totalComments = comments.length;
  const recentComments = comments.slice(-POST_COMMENT_RESPONSE_LIMIT);
  return {
    id: post.id,
    text: post.text ?? "",
    attachments: normalizeAttachments(post.attachments),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    visibility: post.visibility ?? DEFAULT_POST_VISIBILITY,
    mood: post.mood ?? DEFAULT_POST_MOOD,
    interactions: {
      likes: {
        count: interactions.likes.length,
        viewer: normalizedViewer ? likeSet.has(normalizedViewer) : false,
      },
      reposts: {
        count: interactions.reposts.length,
        viewer: normalizedViewer ? repostSet.has(normalizedViewer) : false,
      },
      shares: {
        count: shareCount,
        viewer: viewerShared,
      },
      comments: {
        total: totalComments,
        entries: recentComments.map((comment) => ({
          id: comment.id,
          text: comment.text,
          createdAt: comment.createdAt,
          author: {
            username: comment.username,
            name: comment.fullName || comment.username,
            badges: comment.badges ?? [],
          },
        })),
      },
    },
  };
}

async function listUserEvents(username) {
  const key = userEventsKey(username);
  const raw = await redisCommand(["LRANGE", key, "0", "-1"]);
  if (!Array.isArray(raw)) {
    return [];
  }
  const nowMs = Date.now();
  const events = [];
  let changed = false;
  raw.forEach((item) => {
    const parsed = parseJsonSafe(item, null);
    if (!parsed) {
      changed = true;
      return;
    }
    const sanitized = sanitizeEventRecord(parsed);
    const expiresTime = sanitized.expiresAt ? Date.parse(sanitized.expiresAt) : NaN;
    if (Number.isNaN(expiresTime) || expiresTime <= nowMs) {
      changed = true;
      return;
    }
    events.push(sanitized);
  });
  const sorted = sortEventsForDisplay(events);
  if (changed) {
    await rewriteList(key, sorted);
  }
  return sorted;
}

async function saveUserEvent(username, event) {
  const key = userEventsKey(username);
  const sanitized = sanitizeEventRecord(event);
  await redisCommand(["LPUSH", key, JSON.stringify(sanitized)]);
  return sanitized;
}

async function deleteUserEvent(username, eventId) {
  const events = await listUserEvents(username);
  const filtered = events.filter((event) => event.id !== eventId);
  if (filtered.length !== events.length) {
    await rewriteList(userEventsKey(username), sortEventsForDisplay(filtered));
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
    .map((post) => sanitizePostRecord(post));
  return sortPostsForDisplay(posts);
}

async function saveUserPost(username, post) {
  const sanitized = sanitizePostRecord(post);
  await redisCommand(["LPUSH", userPostsKey(username), JSON.stringify(sanitized)]);
  return sanitized;
}

async function deleteUserPost(username, postId) {
  const posts = await listUserPosts(username);
  const filtered = posts.filter((post) => post.id !== postId);
  if (filtered.length !== posts.length) {
    await rewriteList(userPostsKey(username), sortPostsForDisplay(filtered));
  }
  return posts.find((post) => post.id === postId) ?? null;
}

async function updateUserPost(username, postId, updates) {
  const posts = await listUserPosts(username);
  const index = posts.findIndex((post) => post.id === postId);
  if (index === -1) {
    return null;
  }
  const existing = posts[index];
  const merged = sanitizePostRecord({
    ...existing,
    ...updates,
    id: existing.id,
    attachments: existing.attachments,
    createdAt: existing.createdAt,
  });
  const nextPosts = posts.slice();
  nextPosts[index] = merged;
  await rewriteList(userPostsKey(username), sortPostsForDisplay(nextPosts));
  return merged;
}

async function updatePostInteractions(username, postId, mutator) {
  const posts = await listUserPosts(username);
  const index = posts.findIndex((post) => post.id === postId);
  if (index === -1) {
    return null;
  }
  const existing = posts[index];
  const baseInteractions = sanitizePostInteractions(existing.interactions);
  const working = {
    likes: [...baseInteractions.likes],
    reposts: [...baseInteractions.reposts],
    shares: baseInteractions.shares.map((entry) => ({ ...entry })),
    comments: baseInteractions.comments.map((entry) => ({ ...entry })),
  };
  const mutated = mutator ? mutator(working) : working;
  const nextInteractions = sanitizePostInteractions(mutated);
  const nextRecord = sanitizePostRecord({
    ...existing,
    interactions: nextInteractions,
  });
  const nextPosts = posts.slice();
  nextPosts[index] = nextRecord;
  await rewriteList(userPostsKey(username), sortPostsForDisplay(nextPosts));
  return nextRecord;
}

async function buildAdminUserPayload(username) {
  const user = await getUser(username);
  if (!user) {
    return null;
  }
  const [incoming, outgoing, events, posts] = await Promise.all([
    getIncomingConnections(user.username),
    getOutgoingConnections(user.username),
    listUserEvents(user.username),
    listUserPosts(user.username),
  ]);
  const { passwordHash: _passwordHash, ...profile } = user;
  return {
    profile,
    connections: { incoming, outgoing },
    events,
    posts,
  };
}

async function listAdminUsers() {
  const summaries = await listUsers({ includeHidden: true });
  const usernames = summaries.map((entry) => entry.username).filter(Boolean);
  const users = [];
  for (const username of usernames) {
    const payload = await buildAdminUserPayload(username);
    if (payload) {
      users.push(payload);
    }
  }
  users.sort((a, b) => a.profile.username.localeCompare(b.profile.username));
  return users;
}

async function viewerCanSeePost(viewerUsername, ownerUsername, post) {
  const normalizedViewer = normalizeUsername(viewerUsername);
  const normalizedOwner = normalizeUsername(ownerUsername);
  if (!normalizedViewer || !normalizedOwner || !post) {
    return false;
  }
  if (normalizedViewer === normalizedOwner) {
    return true;
  }
  const visibility = normalizePostVisibility(post.visibility);
  if (visibility === "public") {
    return true;
  }
  if (visibility === "private") {
    return false;
  }
  const [incomingToOwner, outgoingFromOwner] = await Promise.all([
    getIncomingConnections(normalizedOwner),
    getOutgoingConnections(normalizedOwner),
  ]);
  const viewerOutbound = connectionStateFor(normalizedViewer, incomingToOwner);
  const viewerInbound = connectionStateFor(normalizedViewer, outgoingFromOwner);
  return (
    (viewerOutbound.status && viewerOutbound.status !== "none") ||
    (viewerInbound.status && viewerInbound.status !== "none")
  );
}

function publicUser(user) {
  const badges = enforceBadgeRules(user.username, user.badges);
  return {
    fullName: user.fullName,
    username: user.username,
    tagline: user.tagline ?? "",
    bio: user.bio ?? "",
    profilePicture: user.profilePicturePath ? resolveMediaUrl(user.profilePicturePath) : "",
    badges,
    userId: user.userId,
    ageRange: user.ageRange ?? determineAgeRange(user.birthdate),
    previousUsernames: Array.isArray(user.usernameHistory)
      ? user.usernameHistory.map((entry) => entry.username)
      : [],
    usernameChangedAt: user.usernameChangedAt ?? null,
    pronouns: user.pronouns ?? "",
    location: user.location ?? "",
    relationshipStatus: normalizeRelationshipStatus(user.relationshipStatus),
    relationshipStatusLabel: getRelationshipStatusLabel(user.relationshipStatus),
    sexuality: user.sexuality ?? "",
    journey: user.journey ?? "",
    spotlight: user.spotlight ?? "",
    interests: Array.isArray(user.interests) ? user.interests : [],
    links: Array.isArray(user.links)
      ? user.links
          .map((link) => ({
            label: sanitizeText(link?.label ?? "", 60) || sanitizeWebsite(link?.url ?? ""),
            url: sanitizeWebsite(link?.url ?? ""),
          }))
          .filter((link) => Boolean(link.url))
      : [],
  };
}

function sessionUserPayload(user) {
  return {
    ...publicUser(user),
    settings: normalizeUserSettings(user.settings),
  };
}

function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .map((attachment) => ({
      id: attachment.id,
      type: attachment.type,
      url: resolveMediaUrl(attachment.location ?? attachment.url),
      originalName: attachment.originalName ?? "",
      mimeType: attachment.mimeType ?? "",
      size: attachment.size ?? 0,
    }))
    .filter((attachment) => Boolean(attachment.url));
}

function isAiReference(value) {
  if (!value) {
    return false;
  }
  return String(value).trim().toUpperCase() === "AI";
}

function isReadOnlyMethod(method) {
  const normalized = String(method || "GET").toUpperCase();
  return normalized === "GET" || normalized === "HEAD";
}

function isAiPreviewRequest(req) {
  if (!req) {
    return false;
  }
  if (isAiReference(req.query?.ref)) {
    return true;
  }
  if (isAiReference(req.get?.("x-wantyou-ai-guest"))) {
    return true;
  }
  return false;
}

async function authenticate(req, res, next) {
  if (isAiPreviewRequest(req)) {
    if (!isReadOnlyMethod(req.method)) {
      return res.status(403).json({ message: "AI preview is read-only" });
    }
    req.user = aiPreview.getAiUser();
    req.sessionToken = null;
    req.aiGuest = true;
    return next();
  }

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
    req.user = sessionUserPayload(user);
    req.sessionToken = token;
    req.aiGuest = false;
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

  function sendPage(res, ...segments) {
    res.sendFile(path.join(PROJECT_ROOT, ...segments));
  }

  function ensureOwner(req, res, next) {
    if (req.aiGuest) {
      return res.status(403).json({ message: "Owner tools are unavailable in AI preview mode" });
    }
    if (!req.user || req.user.username !== OWNER_USERNAME) {
      return res.status(403).json({ message: "Owner access required" });
    }
    return next();
  }

  app.get("/api/stream", async (req, res) => {
    try {
      if (!isAiPreviewRequest(req)) {
        const tokenParam = req.query?.token;
        const token = typeof tokenParam === "string" ? tokenParam.trim() : "";
        if (!token) {
          return res.status(401).json({ message: "Authentication required" });
        }
        const username = await getSessionUsername(token);
        if (!username) {
          return res.status(401).json({ message: "Session expired" });
        }
      }
    } catch (error) {
      console.error("Unable to authorize realtime stream", error);
      return res.status(500).json({ message: "Unable to establish realtime updates" });
    }

    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    res.write("retry: 5000\n\n");

    let closed = false;
    const heartbeat = setInterval(() => {
      if (closed) return;
      try {
        res.write(":keepalive\n\n");
      } catch (error) {
        cleanup();
      }
    }, 25000);

    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      dataChangeEmitter.off("data", listener);
      try {
        res.end();
      } catch (error) {
        // ignore
      }
    };

    const listener = (payload) => {
      if (closed) return;
      try {
        res.write(`event: data\ndata: ${payload}\n\n`);
      } catch (error) {
        cleanup();
      }
    };

    dataChangeEmitter.on("data", listener);

    const snapshot = latestDataChangeSnapshot();
    if (snapshot?.version > 0) {
      try {
        res.write(`event: data\ndata: ${JSON.stringify(snapshot)}\n\n`);
      } catch (error) {
        cleanup();
        return;
      }
    }

    req.on("close", cleanup);
    req.on("error", cleanup);
  });

  app.get("/lookup", (req, res) => {
    res.redirect(301, "/lookup/");
  });
  app.get("/lookup/", (req, res) => {
    sendPage(res, "lookup", "index.html");
  });

  app.get("/messages", (req, res) => {
    res.redirect(301, "/messages/");
  });
  app.get("/messages/", (req, res) => {
    sendPage(res, "messages", "index.html");
  });

  app.get("/signup", (req, res) => {
    res.redirect(301, "/signup/");
  });
  app.get("/signup/", (req, res) => {
    sendPage(res, "signup", "index.html");
  });

  app.get("/profile", (req, res) => {
    sendPage(res, "profile", "index.html");
  });
  app.get("/profile/", (req, res) => {
    sendPage(res, "profile", "index.html");
  });
  app.get("/profile/@:username", (req, res) => {
    const normalizedTarget = normalizeUsername(req.params.username || "");
    if (!normalizedTarget) {
      res.redirect(301, "/profile/");
      return;
    }
    res.redirect(301, `/profile/@${normalizedTarget}/`);
  });
  app.get("/profile/@:username/", (req, res) => {
    sendPage(res, "profile", "index.html");
  });

  app.get("/data", (req, res) => {
    res.redirect(301, "/data/");
  });
  app.get("/data/", (req, res) => {
    sendPage(res, "data", "index.html");
  });

  app.get("/feed.html", (req, res) => {
    res.redirect(301, "/lookup/");
  });
  app.get("/messages.html", (req, res) => {
    res.redirect(301, "/messages/");
  });
  app.get("/profile.html", (req, res) => {
    const target = normalizeUsername(req.query.user || "");
    if (target) {
      res.redirect(301, `/profile/@${target}/`);
      return;
    }
    res.redirect(301, "/profile/");
  });
  app.get("/signup.html", (req, res) => {
    res.redirect(301, "/signup/");
  });

  app.get("/api/media/:id", async (req, res) => {
    const mediaId = req.params.id;
    if (!mediaId || !USE_KV_MEDIA_STORAGE) {
      return res.status(404).json({ message: "File not found" });
    }
    try {
      const raw = await redisCommand(["GET", mediaKey(mediaId)]);
      if (!raw) {
        return res.status(404).json({ message: "File not found" });
      }
      const payload = parseJsonSafe(raw, null);
      if (!payload?.data || !payload?.mimeType) {
        return res.status(404).json({ message: "File not found" });
      }
      const buffer = Buffer.from(payload.data, "base64");
      res.setHeader("Content-Type", payload.mimeType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.send(buffer);
    } catch (error) {
      console.error("Failed to stream media", error);
      res.status(500).json({ message: "Unable to load media" });
    }
  });

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
        user: sessionUserPayload(user),
      });
    } catch (error) {
      console.error("Failed to log in", error);
      res.status(500).json({ message: "Unable to log in" });
    }
  });

  app.get("/api/session", authenticate, (req, res) => {
    if (req.aiGuest) {
      res.json(aiPreview.getSessionPayload());
      return;
    }
    res.json({ user: req.user });
  });

  app.get("/api/account/settings", authenticate, async (req, res) => {
    if (req.aiGuest) {
      return res
        .status(403)
        .json({ message: "Account settings are unavailable in preview mode" });
    }
    try {
      const user = await getUser(req.user.username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({
        settings: normalizeUserSettings(user.settings),
        streakWindowHours: STREAK_WINDOW_HOURS,
      });
    } catch (error) {
      console.error("Failed to load account settings", error);
      res.status(500).json({ message: "Unable to load account settings" });
    }
  });

  app.patch("/api/account/settings", authenticate, async (req, res) => {
    if (req.aiGuest) {
      return res
        .status(403)
        .json({ message: "Account settings are unavailable in preview mode" });
    }
    try {
      const user = await getUser(req.user.username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const updates = req.body ?? {};
      let settings = normalizeUserSettings(user.settings);
      let changed = false;

      if (Object.prototype.hasOwnProperty.call(updates, "disabled")) {
        const nextDisabled = Boolean(updates.disabled);
        if (nextDisabled !== settings.disabled) {
          settings.disabled = nextDisabled;
          settings.disabledAt = nextDisabled ? new Date().toISOString() : null;
          if (nextDisabled) {
            settings.messagesEnabled = false;
          }
          changed = true;
        }
      }

      if (Object.prototype.hasOwnProperty.call(updates, "messagesEnabled")) {
        const nextMessages = Boolean(updates.messagesEnabled);
        if (settings.messagesEnabled !== nextMessages) {
          settings.messagesEnabled = nextMessages;
          changed = true;
        }
      }

      if (Object.prototype.hasOwnProperty.call(updates, "readReceiptsEnabled")) {
        const nextReceipts = Boolean(updates.readReceiptsEnabled);
        if (settings.readReceiptsEnabled !== nextReceipts) {
          settings.readReceiptsEnabled = nextReceipts;
          changed = true;
        }
      }

      if (Object.prototype.hasOwnProperty.call(updates, "discoverable")) {
        const nextDiscoverable = Boolean(updates.discoverable);
        if (settings.discoverable !== nextDiscoverable) {
          settings.discoverable = nextDiscoverable;
          changed = true;
        }
      }

      if (!changed) {
        return res.status(400).json({ message: "Provide settings to update" });
      }

      const saved = await writeUserRecord({ ...user, settings });
      req.user = sessionUserPayload(saved);
      res.json({ settings, streakWindowHours: STREAK_WINDOW_HOURS });
    } catch (error) {
      console.error("Failed to update account settings", error);
      res.status(500).json({ message: "Unable to update account settings" });
    }
  });

  app.delete("/api/account", authenticate, async (req, res) => {
    if (req.aiGuest) {
      return res
        .status(403)
        .json({ message: "Account deletion is unavailable in preview mode" });
    }
    try {
      const deleted = await deleteUserAccount(req.user.username);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      if (req.sessionToken) {
        await destroySession(req.sessionToken);
      }
      res.status(204).end();
    } catch (error) {
      console.error("Failed to delete account", error);
      res.status(500).json({ message: "Unable to delete account" });
    }
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
    if (req.aiGuest) {
      res.json(aiPreview.getLookupPayload());
      return;
    }
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
    if (req.aiGuest) {
      const payload = aiPreview.getSelectedThreadPayload();
      if (!payload?.thread) {
        res.status(404).json({ message: "No stored thread" });
        return;
      }
      res.json(payload);
      return;
    }
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
    if (req.aiGuest) {
      res.json(aiPreview.getUsersPayload());
      return;
    }
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

  app.get("/api/admin/data", authenticate, ensureOwner, async (req, res) => {
    try {
      const users = await listAdminUsers();
      res.json({ users, generatedAt: new Date().toISOString() });
    } catch (error) {
      console.error("Failed to load admin data", error);
      res.status(500).json({ message: "Unable to load account data" });
    }
  });

  app.put("/api/admin/users/:username", authenticate, ensureOwner, async (req, res) => {
    const normalizedTarget = normalizeUsername(req.params.username);
    if (!normalizedTarget) {
      return res.status(400).json({ message: "A valid username is required" });
    }
    try {
      let currentRecord = await getUser(normalizedTarget);
      if (!currentRecord) {
        return res.status(404).json({ message: "User not found" });
      }

      const { profile, connections, events, posts, username: requestedUsernameRaw } = req.body ?? {};
      let changed = false;
      let profilePayload = null;

      if (isPlainObject(profile) && Object.keys(profile).length) {
        profilePayload = profile;
      }

      const requestedUsername =
        typeof requestedUsernameRaw === "string" ? normalizeUsername(requestedUsernameRaw) : null;

      if (requestedUsername && requestedUsername !== currentRecord.username) {
        const conflict = await getUser(requestedUsername);
        if (conflict && conflict.userId !== currentRecord.userId) {
          return res.status(409).json({ message: "Username is already taken" });
        }
        try {
          currentRecord = await renameUserAccount(
            currentRecord,
            requestedUsername,
            profilePayload ?? {},
            { preserveHistory: true }
          );
          changed = true;
          profilePayload = null;
        } catch (error) {
          return res.status(400).json({ message: error.message || "Unable to rename user" });
        }
      }

      if (profilePayload && Object.keys(profilePayload).length) {
        try {
          currentRecord = await writeUserRecord({
            ...currentRecord,
            ...profilePayload,
            username: currentRecord.username,
            userId: currentRecord.userId,
            passwordHash: currentRecord.passwordHash,
          });
          changed = true;
        } catch (error) {
          return res.status(400).json({ message: error.message || "Profile update invalid" });
        }
      }

      if (isPlainObject(connections)) {
        if (isPlainObject(connections.outgoing)) {
          await applyOutgoingConnectionMap(currentRecord.username, connections.outgoing);
          changed = true;
        }
        if (isPlainObject(connections.incoming)) {
          await applyIncomingConnectionMap(currentRecord.username, connections.incoming);
          changed = true;
        }
      }

      if (Array.isArray(events)) {
        try {
          const sanitizedEvents = sortEventsForDisplay(
            events.map((event) => sanitizeEventRecord(event))
          );
          await rewriteList(userEventsKey(currentRecord.username), sanitizedEvents);
          changed = true;
        } catch (error) {
          return res.status(400).json({ message: "Events payload is invalid" });
        }
      }

      if (Array.isArray(posts)) {
        try {
          const sanitizedPosts = sortPostsForDisplay(
            posts.map((post) => sanitizePostRecord(post))
          );
          await rewriteList(userPostsKey(currentRecord.username), sanitizedPosts);
          changed = true;
        } catch (error) {
          return res.status(400).json({ message: "Posts payload is invalid" });
        }
      }

      if (!changed) {
        return res.status(400).json({ message: "Provide account changes to save" });
      }

      const payload = await buildAdminUserPayload(currentRecord.username);
      res.json({ user: payload });
    } catch (error) {
      console.error("Failed to update account", error);
      res.status(500).json({ message: "Unable to save account changes" });
    }
  });

  app.get("/api/messages/threads", authenticate, async (req, res) => {
    if (req.aiGuest) {
      res.json(aiPreview.getThreadsPayload());
      return;
    }
    try {
      const people = await getLookupPeople(req.user.username, { includeHidden: true });
      const metaMap = await getConversationMetaRecords(req.user.username, people);
      const viewerUsername = normalizeUsername(req.user.username);
      const threads = people
        .map((person) => {
          const inbound = person.inbound;
          const outbound = person.outbound;
          const meta = metaMap.get(person.username) ?? null;
          const lastMessage = meta?.lastMessage ?? null;
          const updatedAt =
            meta?.updatedAt ?? outbound.updatedAt ?? inbound.updatedAt ?? null;
          const otherSettings = person.settings ?? DEFAULT_USER_SETTINGS;
          const readAt = filterReadReceiptsForViewer(
            meta?.readAt ?? {},
            req.user.username,
            person.username,
            otherSettings
          );
          const normalizedPerson = normalizeUsername(person.username);
          const lastReadAt = normalizedPerson ? readAt[normalizedPerson] ?? null : null;
          const viewerReadAt = viewerUsername ? readAt[viewerUsername] ?? null : null;
          const streak = exposeStreak(meta);
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
            unreadCount: meta?.unread?.[req.user.username] ?? 0,
            totalMessages: meta?.totalMessages ?? 0,
            readAt,
            lastReadAt,
            viewerReadAt,
            messagingAllowed: otherSettings.messagesEnabled && !otherSettings.disabled,
            targetDisabled: Boolean(otherSettings.disabled),
            streak,
          };
        })
        .filter((thread) => Boolean(thread.lastMessage));
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
    if (req.aiGuest) {
      const target = normalizeUsername(req.params.username);
      const payload = aiPreview.getThreadDetail(target);
      if (!payload) {
        res.status(404).json({ message: "Conversation not found" });
        return;
      }
      res.json(payload);
      return;
    }
    const normalizedTarget = normalizeUsername(req.params.username);
    if (!normalizedTarget) {
      return res.status(400).json({ message: "A valid username is required" });
    }
    try {
      const targetUser = await getUser(normalizedTarget);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const targetSettings = normalizeUserSettings(targetUser.settings);
      const limit = Number.parseInt(req.query.limit, 10);
      const [{ messages, hasMore, previousCursor, total }, incoming, outgoing, meta] =
        await Promise.all([
          getConversationMessages(req.user.username, normalizedTarget, {
            cursor: req.query.cursor,
            limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
          }),
          getIncomingConnections(req.user.username),
          getOutgoingConnections(req.user.username),
          getConversationMeta(req.user.username, normalizedTarget),
        ]);
      const inbound = connectionStateFor(normalizedTarget, incoming);
      const outbound = connectionStateFor(normalizedTarget, outgoing);
      const readAtMap = filterReadReceiptsForViewer(
        meta?.readAt ?? {},
        req.user.username,
        normalizedTarget,
        targetSettings
      );
      const normalizedCurrent = normalizeUsername(req.user.username);
      const otherReadAt = normalizedTarget ? readAtMap[normalizedTarget] ?? null : null;
      const otherReadScore = timestampScore(otherReadAt);
      const viewerReadAt = normalizedCurrent ? readAtMap[normalizedCurrent] ?? null : null;
      const canShowReceipts = targetSettings.readReceiptsEnabled !== false;
      const streak = exposeStreak(meta);
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
          read:
            canShowReceipts &&
            Boolean(
              otherReadScore &&
                message.createdAt &&
                otherReadScore >= timestampScore(message.createdAt)
            ),
          readAt:
            canShowReceipts &&
            otherReadAt &&
            message.createdAt &&
            otherReadScore >= timestampScore(message.createdAt)
              ? otherReadAt
              : null,
        })),
        hasMore,
        previousCursor,
        totalMessages: Number.isFinite(total) ? total : messages.length,
        unreadCount: meta?.unread?.[req.user.username] ?? 0,
        readAt: readAtMap,
        lastReadAt: otherReadAt ?? null,
        viewerReadAt,
        messagingAllowed: targetSettings.messagesEnabled && !targetSettings.disabled,
        targetDisabled: Boolean(targetSettings.disabled),
        streak,
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
      const targetSettings = normalizeUserSettings(targetUser.settings);
      if (targetSettings.disabled) {
        return res.status(403).json({ message: "This account is currently disabled." });
      }
      if (targetSettings.messagesEnabled === false) {
        return res
          .status(403)
          .json({ message: "This person has paused new messages right now." });
      }
      const message = await appendConversationMessage(
        req.user.username,
        normalizedTarget,
        trimmed
      );
      const meta = await getConversationMeta(req.user.username, normalizedTarget);
      res.status(201).json({
        message: {
          id: message.id,
          sender: message.sender,
          text: message.text,
          createdAt: message.createdAt,
        },
        streak: exposeStreak(meta),
      });
    } catch (error) {
      console.error("Failed to save message", error);
      res.status(500).json({ message: "Unable to send message" });
    }
  });

  app.post("/api/messages/thread/:username/read", authenticate, async (req, res) => {
    const normalizedTarget = normalizeUsername(req.params.username);
    if (!normalizedTarget) {
      return res.status(400).json({ message: "A valid username is required" });
    }
    try {
      const targetUser = await getUser(normalizedTarget);
      const targetSettings = normalizeUserSettings(targetUser?.settings);
      const meta = await markConversationRead(req.user.username, normalizedTarget);
      const readAt = filterReadReceiptsForViewer(
        meta?.readAt ?? {},
        req.user.username,
        normalizedTarget,
        targetSettings
      );
      const normalizedCurrent = normalizeUsername(req.user.username);
      res.json({
        unreadCount: meta?.unread?.[req.user.username] ?? 0,
        readAt,
        lastReadAt: readAt[normalizedTarget] ?? null,
        viewerReadAt: normalizedCurrent ? readAt[normalizedCurrent] ?? null : null,
      });
    } catch (error) {
      console.error("Failed to mark conversation read", error);
      res.status(500).json({ message: "Unable to update read state" });
    }
  });

  app.get("/api/profile", authenticate, async (req, res) => {
    if (req.aiGuest) {
      const requested = normalizeUsername(req.query.user) || req.user.username;
      const payload = aiPreview.getProfilePayload(requested);
      if (!payload) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      res.json(payload);
      return;
    }
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
      let filteredPosts = posts;
      if (!isSelf) {
        const [incomingToTarget, outgoingFromTarget] = await Promise.all([
          getIncomingConnections(requested),
          getOutgoingConnections(requested),
        ]);
        const viewerUsername = req.user.username;
        const viewerOutbound = connectionStateFor(viewerUsername, incomingToTarget);
        const viewerInbound = connectionStateFor(viewerUsername, outgoingFromTarget);
        const hasConnection =
          (viewerOutbound.status && viewerOutbound.status !== "none") ||
          (viewerInbound.status && viewerInbound.status !== "none");
        filteredPosts = posts.filter((post) => {
          if (post.visibility === "private") {
            return false;
          }
          if (post.visibility === "connections") {
            return hasConnection;
          }
          return true;
        });
      }
      const canVerify = req.user.username === OWNER_USERNAME && requested !== req.user.username;

      const response = {
        user: publicUser({ ...targetUser }),
      };
      if (canVerify) {
        response.user.birthdate = targetUser.birthdate ?? null;
      }

      const eventPayload = events.map((event) => ({
          id: event.id,
          text: event.text ?? "",
          attachments: normalizeAttachments(event.attachments),
          createdAt: event.createdAt,
          expiresAt: event.expiresAt,
          durationHours: event.durationHours,
          accent: normalizeEventAccent(event.accent),
          highlighted: Boolean(event.highlighted),
        }));

      const postPayload = filteredPosts.map((post) => describePostForViewer(post, req.user.username));

      response.events = eventPayload;
      response.posts = postPayload;
      response.canEdit = isSelf;
      response.maxUploadSize = MAX_MEDIA_FILE_SIZE;

      const nowMs = Date.now();
      const activeEvents = eventPayload.filter((event) => {
        if (!event.expiresAt) return true;
        const expiry = Date.parse(event.expiresAt);
        if (Number.isNaN(expiry)) return true;
        return expiry > nowMs;
      });
      const highlightedEvents = eventPayload.filter((event) => event.highlighted);
      const visibilityTotals = postPayload.reduce(
        (acc, post) => {
          const visibility = VALID_POST_VISIBILITIES.has(post.visibility)
            ? post.visibility
            : DEFAULT_POST_VISIBILITY;
          acc[visibility] = (acc[visibility] ?? 0) + 1;
          return acc;
        },
        { public: 0, connections: 0, private: 0 }
      );
      const moodsUsed = new Set(
        postPayload
          .map((post) => post.mood)
          .filter((mood) => mood && mood !== DEFAULT_POST_MOOD)
      );
      const eventMediaCount = eventPayload.reduce(
        (count, event) => count + (Array.isArray(event.attachments) ? event.attachments.length : 0),
        0
      );
      const postMediaCount = postPayload.reduce(
        (count, post) => count + (Array.isArray(post.attachments) ? post.attachments.length : 0),
        0
      );
      const lastActivityTimestamps = [];
      eventPayload.forEach((event) => {
        if (event.createdAt) {
          const timestamp = Date.parse(event.createdAt);
          if (!Number.isNaN(timestamp)) {
            lastActivityTimestamps.push(timestamp);
          }
        }
      });
      postPayload.forEach((post) => {
        const source = post.updatedAt || post.createdAt;
        if (!source) return;
        const timestamp = Date.parse(source);
        if (!Number.isNaN(timestamp)) {
          lastActivityTimestamps.push(timestamp);
        }
      });
      const lastActivityAt = lastActivityTimestamps.length
        ? new Date(Math.max(...lastActivityTimestamps)).toISOString()
        : null;

      response.activity = {
        activeEvents: activeEvents.length,
        highlightedEvents: highlightedEvents.length,
        totalPosts: postPayload.length,
        publicPosts: visibilityTotals.public ?? 0,
        connectionsPosts: visibilityTotals.connections ?? 0,
        privatePosts: visibilityTotals.private ?? 0,
        totalMedia: eventMediaCount + postMediaCount,
        moodsUsed: moodsUsed.size,
        lastUpdatedAt: lastActivityAt,
      };

      response.canVerify = canVerify;

      if (isSelf) {
        const [incoming, outgoing, users] = await Promise.all([
          getIncomingConnections(req.user.username),
          getOutgoingConnections(req.user.username),
          listUsers({ includeHidden: true }),
        ]);
        const userMap = new Map(users.map((user) => [user.username, user]));
        response.stats = countStatuses(incoming);
        response.anonymous = buildAnonymousList({ incoming, userMap });
        response.recent = buildRecentUpdates({ incoming, outgoing, userMap });
        response.activity.statusTotals = response.stats;
        response.settings = normalizeUserSettings(targetUser.settings);
        response.streakWindowHours = STREAK_WINDOW_HOURS;
      }

      res.json(response);
    } catch (error) {
      console.error("Failed to load profile", error);
      res.status(500).json({ message: "Unable to load profile" });
    }
  });

  app.put("/api/profile", authenticate, async (req, res) => {
    const { tagline, bio, fullName, username } = req.body ?? {};
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
    if (typeof req.body?.pronouns === "string") {
      if (req.body.pronouns.length > 40) {
        return res.status(400).json({ message: "Pronouns must be 40 characters or fewer" });
      }
      updates.pronouns = req.body.pronouns.trim();
    }
    if (typeof req.body?.location === "string") {
      if (req.body.location.length > 120) {
        return res.status(400).json({ message: "Location must be 120 characters or fewer" });
      }
      updates.location = req.body.location.trim();
    }
    if (typeof req.body?.relationshipStatus === "string") {
      updates.relationshipStatus = normalizeRelationshipStatus(req.body.relationshipStatus);
    } else if (typeof req.body?.availability === "string") {
      updates.relationshipStatus = normalizeRelationshipStatus(req.body.availability);
    }
    if (typeof req.body?.sexuality === "string") {
      if (req.body.sexuality.length > 60) {
        return res.status(400).json({ message: "Sexuality must be 60 characters or fewer" });
      }
      updates.sexuality = req.body.sexuality.trim();
    }
    if (typeof req.body?.journey === "string") {
      if (req.body.journey.length > 600) {
        return res.status(400).json({ message: "Journey must be 600 characters or fewer" });
      }
      updates.journey = req.body.journey.trim();
    }
    if (typeof req.body?.spotlight === "string") {
      if (req.body.spotlight.length > 280) {
        return res.status(400).json({ message: "Spotlight must be 280 characters or fewer" });
      }
      updates.spotlight = req.body.spotlight.trim();
    }
    if (typeof req.body?.interests === "string") {
      updates.interests = sanitizeInterestList(req.body.interests);
    } else if (Array.isArray(req.body?.interests)) {
      updates.interests = sanitizeInterestList(req.body.interests);
    }
    if (typeof req.body?.links === "string") {
      updates.links = sanitizeLinkEntries(req.body.links);
    } else if (Array.isArray(req.body?.links)) {
      updates.links = sanitizeLinkEntries(req.body.links);
    }
    if (typeof fullName === "string") {
      const trimmedName = fullName.trim();
      if (!trimmedName) {
        return res.status(400).json({ message: "Full name cannot be empty" });
      }
      if (trimmedName.length > 120) {
        return res.status(400).json({ message: "Full name must be 120 characters or fewer" });
      }
      updates.fullName = trimmedName;
    }

    const requestedUsername = typeof username === "string" ? normalizeUsername(username) : null;
    const wantsUsernameChange = requestedUsername && requestedUsername !== req.user.username;
    if (!Object.keys(updates).length && !wantsUsernameChange) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    try {
      const existing = await getUser(req.user.username);
      if (!existing) {
        return res.status(404).json({ message: "User not found" });
      }

      let updated = existing;
      if (wantsUsernameChange) {
        const conflict = await getUser(requestedUsername);
        if (conflict && conflict.userId !== existing.userId) {
          return res.status(409).json({ message: "Username is already taken" });
        }
        const lastChangedAt = existing.usernameChangedAt;
        if (lastChangedAt) {
          const lastChangeTime = Date.parse(lastChangedAt);
          if (!Number.isNaN(lastChangeTime)) {
            const nextAllowed = lastChangeTime + USERNAME_CHANGE_INTERVAL_MS;
            if (Date.now() < nextAllowed) {
              const retryDate = new Date(nextAllowed).toISOString();
              return res
                .status(429)
                .json({ message: `You can change your username again on ${retryDate}` });
            }
          }
        }
        updated = await renameUserAccount(existing, requestedUsername, updates);
        if (req.sessionToken) {
          await redisCommand(["SET", sessionKey(req.sessionToken), updated.username, "EX", "86400"]);
        }
      } else {
        updated = await updateUserProfile(existing.username, updates);
      }

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
    const { username, verified, birthdate } = req.body ?? {};
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
      let nextBirthdate = targetUser.birthdate ?? null;
      if (verified) {
        const normalizedBirthdate = normalizeBirthdateInput(birthdate);
        if (!normalizedBirthdate) {
          return res.status(400).json({ message: "Verified members need a valid birthdate (YYYY-MM-DD)" });
        }
        nextBirthdate = normalizedBirthdate;
        badgeSet.add(BADGE_TYPES.VERIFIED);
      } else {
        badgeSet.delete(BADGE_TYPES.VERIFIED);
      }
      const updated = await writeUserRecord({
        ...targetUser,
        badges: [...badgeSet],
        birthdate: nextBirthdate,
      });
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
      let media = null;
      try {
        const user = await getUser(req.user.username);
        if (!user) {
          await removeFileSafe(req.file.path);
          return res.status(404).json({ message: "User not found" });
        }
        media = await persistMediaFile(req.file);
        if (!media?.location) {
          await removeFileSafe(req.file.path);
          return res.status(500).json({ message: "Unable to store profile picture" });
        }
        const previousLocation = user.profilePicturePath;
        const updated = await updateUserProfile(req.user.username, {
          profilePicturePath: media.location,
        });
        if (previousLocation && previousLocation !== media.location) {
          await removeMediaLocation(previousLocation);
        }
        res.status(201).json({ user: publicUser(updated) });
      } catch (err) {
        console.error("Failed to upload profile picture", err);
        if (media?.location) {
          await removeMediaLocation(media.location);
        } else if (req.file?.path) {
          await removeFileSafe(req.file.path);
        }
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
      const requestedDuration = normalizeEventDuration(req.body?.durationHours);
      const accent = normalizeEventAccent(req.body?.accent);
      const highlighted = Boolean(
        req.body?.highlighted === "on" ||
          req.body?.highlighted === "true" ||
          req.body?.highlighted === "1"
      );
      const attachments = Array.isArray(req.files)
        ? (await Promise.all(req.files.map((file) => describeAttachment(file)))).filter(Boolean)
        : [];
      if (!text && !attachments.length) {
        await cleanupAttachments(attachments);
        return res.status(400).json({ message: "Add text or media to your event" });
      }
      try {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + requestedDuration * 60 * 60 * 1000).toISOString();
        const event = {
          id: crypto.randomUUID(),
          text,
          attachments,
          createdAt: now.toISOString(),
          expiresAt,
          durationHours: requestedDuration,
          accent,
          highlighted,
        };
        const stored = await saveUserEvent(req.user.username, event);
        res.status(201).json({
          event: {
            id: stored.id,
            text: stored.text,
            attachments: normalizeAttachments(stored.attachments),
            createdAt: stored.createdAt,
            expiresAt: stored.expiresAt,
            durationHours: stored.durationHours,
            accent: stored.accent,
            highlighted: stored.highlighted,
          },
        });
      } catch (err) {
        console.error("Failed to save event", err);
        await cleanupAttachments(attachments);
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
        await cleanupAttachments(target.attachments);
      }
      res.status(204).end();
    } catch (error) {
      console.error("Failed to delete event", error);
      res.status(500).json({ message: "Unable to delete event" });
    }
  });

  app.post("/api/profile/:username/posts/:id/like", authenticate, async (req, res) => {
    const owner = normalizeUsername(req.params.username);
    const postId = req.params.id;
    const viewer = normalizeUsername(req.user.username);
    if (!owner || !postId) {
      return res.status(400).json({ message: "Post owner and id required" });
    }
    if (!viewer) {
      return res.status(400).json({ message: "Viewer missing" });
    }
    if (owner === viewer) {
      return res.status(403).json({ message: "You can't like your own post" });
    }
    try {
      const ownerUser = await getUser(owner);
      if (!ownerUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const posts = await listUserPosts(owner);
      const target = posts.find((post) => post.id === postId);
      if (!target) {
        return res.status(404).json({ message: "Post not found" });
      }
      const canView = await viewerCanSeePost(viewer, owner, target);
      if (!canView) {
        return res.status(403).json({ message: "You do not have access to this post" });
      }
      const updated = await updatePostInteractions(owner, postId, (interactions) => {
        const likeSet = new Set(interactions.likes);
        likeSet.add(viewer);
        return { ...interactions, likes: Array.from(likeSet.values()) };
      });
      if (!updated) {
        return res.status(404).json({ message: "Post not found" });
      }
      res.json({ post: describePostForViewer(updated, viewer) });
    } catch (error) {
      console.error("Failed to like post", error);
      res.status(500).json({ message: "Unable to like post" });
    }
  });

  app.delete("/api/profile/:username/posts/:id/like", authenticate, async (req, res) => {
    const owner = normalizeUsername(req.params.username);
    const postId = req.params.id;
    const viewer = normalizeUsername(req.user.username);
    if (!owner || !postId) {
      return res.status(400).json({ message: "Post owner and id required" });
    }
    if (!viewer) {
      return res.status(400).json({ message: "Viewer missing" });
    }
    if (owner === viewer) {
      return res.status(403).json({ message: "You can't unlike your own post" });
    }
    try {
      const ownerUser = await getUser(owner);
      if (!ownerUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const posts = await listUserPosts(owner);
      const target = posts.find((post) => post.id === postId);
      if (!target) {
        return res.status(404).json({ message: "Post not found" });
      }
      const canView = await viewerCanSeePost(viewer, owner, target);
      if (!canView) {
        return res.status(403).json({ message: "You do not have access to this post" });
      }
      const updated = await updatePostInteractions(owner, postId, (interactions) => {
        const likeSet = new Set(interactions.likes);
        likeSet.delete(viewer);
        return { ...interactions, likes: Array.from(likeSet.values()) };
      });
      if (!updated) {
        return res.status(404).json({ message: "Post not found" });
      }
      res.json({ post: describePostForViewer(updated, viewer) });
    } catch (error) {
      console.error("Failed to remove like", error);
      res.status(500).json({ message: "Unable to update like" });
    }
  });

  app.post("/api/profile/:username/posts/:id/repost", authenticate, async (req, res) => {
    const owner = normalizeUsername(req.params.username);
    const postId = req.params.id;
    const viewer = normalizeUsername(req.user.username);
    if (!owner || !postId) {
      return res.status(400).json({ message: "Post owner and id required" });
    }
    if (!viewer) {
      return res.status(400).json({ message: "Viewer missing" });
    }
    if (owner === viewer) {
      return res.status(403).json({ message: "You can't repost your own update" });
    }
    try {
      const ownerUser = await getUser(owner);
      if (!ownerUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const posts = await listUserPosts(owner);
      const target = posts.find((post) => post.id === postId);
      if (!target) {
        return res.status(404).json({ message: "Post not found" });
      }
      const canView = await viewerCanSeePost(viewer, owner, target);
      if (!canView) {
        return res.status(403).json({ message: "You do not have access to this post" });
      }
      const updated = await updatePostInteractions(owner, postId, (interactions) => {
        const repostSet = new Set(interactions.reposts);
        repostSet.add(viewer);
        return { ...interactions, reposts: Array.from(repostSet.values()) };
      });
      if (!updated) {
        return res.status(404).json({ message: "Post not found" });
      }
      res.json({ post: describePostForViewer(updated, viewer) });
    } catch (error) {
      console.error("Failed to repost", error);
      res.status(500).json({ message: "Unable to repost" });
    }
  });

  app.delete("/api/profile/:username/posts/:id/repost", authenticate, async (req, res) => {
    const owner = normalizeUsername(req.params.username);
    const postId = req.params.id;
    const viewer = normalizeUsername(req.user.username);
    if (!owner || !postId) {
      return res.status(400).json({ message: "Post owner and id required" });
    }
    if (!viewer) {
      return res.status(400).json({ message: "Viewer missing" });
    }
    if (owner === viewer) {
      return res.status(403).json({ message: "You can't undo reposts on your own post" });
    }
    try {
      const ownerUser = await getUser(owner);
      if (!ownerUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const posts = await listUserPosts(owner);
      const target = posts.find((post) => post.id === postId);
      if (!target) {
        return res.status(404).json({ message: "Post not found" });
      }
      const canView = await viewerCanSeePost(viewer, owner, target);
      if (!canView) {
        return res.status(403).json({ message: "You do not have access to this post" });
      }
      const updated = await updatePostInteractions(owner, postId, (interactions) => {
        const repostSet = new Set(interactions.reposts);
        repostSet.delete(viewer);
        return { ...interactions, reposts: Array.from(repostSet.values()) };
      });
      if (!updated) {
        return res.status(404).json({ message: "Post not found" });
      }
      res.json({ post: describePostForViewer(updated, viewer) });
    } catch (error) {
      console.error("Failed to remove repost", error);
      res.status(500).json({ message: "Unable to update repost" });
    }
  });

  app.post("/api/profile/:username/posts/:id/share", authenticate, async (req, res) => {
    const owner = normalizeUsername(req.params.username);
    const postId = req.params.id;
    const viewer = normalizeUsername(req.user.username);
    if (!owner || !postId) {
      return res.status(400).json({ message: "Post owner and id required" });
    }
    if (!viewer) {
      return res.status(400).json({ message: "Viewer missing" });
    }
    if (owner === viewer) {
      return res.status(403).json({ message: "You can't share your own post" });
    }
    try {
      const ownerUser = await getUser(owner);
      if (!ownerUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const posts = await listUserPosts(owner);
      const target = posts.find((post) => post.id === postId);
      if (!target) {
        return res.status(404).json({ message: "Post not found" });
      }
      const canView = await viewerCanSeePost(viewer, owner, target);
      if (!canView) {
        return res.status(403).json({ message: "You do not have access to this post" });
      }
      const updated = await updatePostInteractions(owner, postId, (interactions) => {
        const remainingShares = interactions.shares.filter((share) => share.username !== viewer);
        remainingShares.push({ username: viewer, createdAt: new Date().toISOString() });
        return { ...interactions, shares: remainingShares };
      });
      if (!updated) {
        return res.status(404).json({ message: "Post not found" });
      }
      res.json({ post: describePostForViewer(updated, viewer) });
    } catch (error) {
      console.error("Failed to share post", error);
      res.status(500).json({ message: "Unable to share post" });
    }
  });

  app.post("/api/profile/:username/posts/:id/comments", authenticate, async (req, res) => {
    const owner = normalizeUsername(req.params.username);
    const postId = req.params.id;
    const viewer = normalizeUsername(req.user.username);
    if (!owner || !postId) {
      return res.status(400).json({ message: "Post owner and id required" });
    }
    if (!viewer) {
      return res.status(400).json({ message: "Viewer missing" });
    }
    if (owner === viewer) {
      return res.status(403).json({ message: "You can't comment on your own post" });
    }
    const text = sanitizeText(req.body?.text ?? "", MAX_POST_COMMENT_LENGTH);
    if (!text) {
      return res.status(400).json({ message: "Comment cannot be empty" });
    }
    try {
      const ownerUser = await getUser(owner);
      if (!ownerUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const posts = await listUserPosts(owner);
      const target = posts.find((post) => post.id === postId);
      if (!target) {
        return res.status(404).json({ message: "Post not found" });
      }
      const canView = await viewerCanSeePost(viewer, owner, target);
      if (!canView) {
        return res.status(403).json({ message: "You do not have access to this post" });
      }
      const updated = await updatePostInteractions(owner, postId, (interactions) => {
        const comments = interactions.comments.slice();
        comments.push({
          id: crypto.randomUUID(),
          username: viewer,
          fullName: req.user.fullName ?? viewer,
          text,
          createdAt: new Date().toISOString(),
          badges: Array.isArray(req.user.badges) ? req.user.badges : [],
        });
        return { ...interactions, comments };
      });
      if (!updated) {
        return res.status(404).json({ message: "Post not found" });
      }
      res.status(201).json({ post: describePostForViewer(updated, viewer) });
    } catch (error) {
      console.error("Failed to add comment", error);
      res.status(500).json({ message: "Unable to comment right now" });
    }
  });

  app.post("/api/posts", authenticate, (req, res) => {
    req.uploadTarget = "post";
    uploadMiddleware.array("media", 6)(req, res, async (error) => {
      if (error) {
        return uploadErrorResponse(res, error);
      }
      const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
      const visibility = normalizePostVisibility(req.body?.visibility);
      const mood = normalizePostMood(req.body?.mood);
      const attachments = Array.isArray(req.files)
        ? (await Promise.all(req.files.map((file) => describeAttachment(file)))).filter(Boolean)
        : [];
      if (text.length > 1000) {
        await cleanupAttachments(attachments);
        return res.status(400).json({ message: "Posts must be 1000 characters or fewer" });
      }
      if (!text && !attachments.length) {
        await cleanupAttachments(attachments);
        return res.status(400).json({ message: "Posts must include text or media" });
      }
      try {
        const nowIso = new Date().toISOString();
        const post = {
          id: crypto.randomUUID(),
          text,
          attachments,
          createdAt: nowIso,
          updatedAt: nowIso,
          visibility,
          mood,
        };
        const stored = await saveUserPost(req.user.username, post);
        res.status(201).json({
          post: describePostForViewer(stored, req.user.username),
        });
      } catch (err) {
        console.error("Failed to create post", err);
        await cleanupAttachments(attachments);
        res.status(500).json({ message: "Unable to publish post" });
      }
    });
  });

  app.patch("/api/posts/:id", authenticate, async (req, res) => {
    const postId = req.params.id;
    if (!postId) {
      return res.status(400).json({ message: "Post id required" });
    }
    const { text, visibility, mood } = req.body ?? {};
    try {
      const posts = await listUserPosts(req.user.username);
      const target = posts.find((post) => post.id === postId);
      if (!target) {
        return res.status(404).json({ message: "Post not found" });
      }
      const updates = {};
      if (text !== undefined) {
        if (typeof text !== "string") {
          return res.status(400).json({ message: "Post text must be a string" });
        }
        const trimmed = text.trim();
        if (trimmed.length > 1000) {
          return res.status(400).json({ message: "Posts must be 1000 characters or fewer" });
        }
        if (!trimmed && !(target.attachments?.length)) {
          return res.status(400).json({ message: "Posts must include text or media" });
        }
        updates.text = trimmed;
      }
      if (visibility !== undefined) {
        updates.visibility = normalizePostVisibility(visibility);
      }
      if (mood !== undefined) {
        updates.mood = normalizePostMood(mood);
      }
      if (!Object.keys(updates).length) {
        return res.status(400).json({ message: "Nothing to update" });
      }
      updates.updatedAt = new Date().toISOString();
      const updated = await updateUserPost(req.user.username, postId, updates);
      if (!updated) {
        return res.status(404).json({ message: "Post not found" });
      }
      res.json({
        post: describePostForViewer(updated, req.user.username),
      });
    } catch (err) {
      console.error("Failed to update post", err);
      res.status(500).json({ message: "Unable to update post" });
    }
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
        await cleanupAttachments(target.attachments);
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
