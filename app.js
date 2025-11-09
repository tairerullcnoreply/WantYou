const AI_REF_PARAM = "ref";
const AI_REF_VALUE = "AI";
const AI_GUEST_STORAGE_KEY = "wantyou_ai_guest";
const AI_GUEST_HEADER = "X-WantYou-AI-Guest";

let aiGuestMode = false;

const STATUS_LABELS = {
  none: "No status yet",
  know: "This user knows you",
  want: "This user wants you",
  both: "This user both knows and wants you",
};

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function isAiReferenceValue(value) {
  if (!value) {
    return false;
  }
  return String(value).trim().toUpperCase() === AI_REF_VALUE;
}

function isReadOnlyMethod(method) {
  const normalized = String(method || "GET").toUpperCase();
  return normalized === "GET" || normalized === "HEAD";
}

function isAiGuestMode() {
  return aiGuestMode;
}

function withAiRef(url) {
  if (!isAiGuestMode() || !url) {
    return url;
  }
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin) {
      return url;
    }
    if (!isAiReferenceValue(parsed.searchParams.get(AI_REF_PARAM))) {
      parsed.searchParams.set(AI_REF_PARAM, AI_REF_VALUE);
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (error) {
    return url;
  }
}

function applyAiRefToAnchors(root = document) {
  if (!isAiGuestMode()) {
    return;
  }
  if (!root || typeof root.querySelectorAll !== "function") {
    return;
  }
  root.querySelectorAll("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#")) {
      return;
    }
    if (/^(mailto:|tel:|sms:|javascript:)/i.test(href)) {
      return;
    }
    try {
      const parsed = new URL(href, window.location.origin);
      if (parsed.origin !== window.location.origin) {
        return;
      }
      const next = withAiRef(`${parsed.pathname}${parsed.search}${parsed.hash}`);
      if (next) {
        anchor.setAttribute("href", next);
      }
    } catch (error) {
      // ignore invalid URLs
    }
  });
}

function initializeAiGuestMode() {
  let hasRef = false;
  try {
    const params = new URLSearchParams(window.location.search);
    hasRef = isAiReferenceValue(params.get(AI_REF_PARAM));
  } catch (error) {
    hasRef = false;
  }

  let remembered = false;
  try {
    remembered = window.sessionStorage.getItem(AI_GUEST_STORAGE_KEY) === "1";
  } catch (error) {
    remembered = false;
  }

  aiGuestMode = hasRef || remembered;

  if (hasRef) {
    try {
      window.sessionStorage.setItem(AI_GUEST_STORAGE_KEY, "1");
    } catch (error) {
      // Ignore storage failures; still continue in preview mode.
    }
  }

  if (!isAiGuestMode()) {
    return;
  }

  if (document.body) {
    document.body.classList.add("ai-preview");
  }

  applyAiRefToAnchors(document);

  document.addEventListener("click", (event) => {
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor) {
      return;
    }
    const href = anchor.getAttribute("href");
    if (!href) {
      return;
    }
    const updated = withAiRef(href);
    if (updated && updated !== href) {
      anchor.setAttribute("href", updated);
    }
  });

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          applyAiRefToAnchors(node);
        }
      });
    });
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  if (document.body) {
    const banner = document.createElement("div");
    banner.className = "ai-preview-banner";
    banner.innerHTML =
      '<p><strong>AI preview:</strong> You\'re browsing WantYou in read-only mode. Links include ?ref=AI and interactive actions are disabled.</p>';
    document.body.insertBefore(banner, document.body.firstChild || null);
  }
}

const STATUS_NAMES = {
  none: "None",
  know: "Know you",
  want: "Want you",
  both: "Both",
};

const STATUS_SORT_WEIGHTS = Object.freeze({
  both: 0,
  want: 1,
  know: 2,
  none: 3,
});

function isWantStatus(status) {
  return status === "want" || status === "both";
}

function getStatusWeight(status) {
  return STATUS_SORT_WEIGHTS[status] ?? 4;
}

function formatCount(value, singular, plural = `${singular}s`) {
  const noun = value === 1 ? singular : plural;
  return `${value} ${noun}`;
}

const USER_BADGE_DEFINITIONS = Object.freeze({
  WantYou: { label: "WantYou", variant: "wantyou", icon: "★" },
  Verified: { label: "Verified", variant: "verified", icon: "✔" },
});

const USER_BADGE_ORDER = Object.freeze(["WantYou", "Verified"]);

const TENOR_API_ENDPOINT = "https://g.tenor.com/v1";
const TENOR_API_KEY = "LIVDSRZULELA";
const TENOR_CLIENT_KEY = "wantyou-messaging";
const TENOR_SEARCH_LIMIT = 24;

const NICKNAME_STORAGE_KEY = "wantyou_chat_nicknames_v2";
const THREAD_THEME_STORAGE_KEY = "wantyou_chat_themes_v1";
const DEFAULT_REACTION_OPTIONS = Object.freeze([
  "👍",
  "❤️",
  "😂",
  "🎉",
  "😮",
  "🔥",
  "🙏",
  "👀",
  "🥰",
  "💯",
]);

const BACKGROUND_THEME_OPTIONS = Object.freeze([
  { value: "default", label: "Classic" },
  { value: "sunrise", label: "Sunrise glow" },
  { value: "ocean", label: "Ocean breeze" },
  { value: "violet", label: "Violet hour" },
]);

const BUBBLE_THEME_OPTIONS = Object.freeze([
  { value: "default", label: "WantYou classic" },
  { value: "citrus", label: "Citrus pop" },
  { value: "lagoon", label: "Lagoon" },
  { value: "dusk", label: "Dusk" },
  { value: "mono", label: "Minimal mono" },
]);

const POST_VISIBILITY_LABELS = Object.freeze({
  public: "Public",
  connections: "Connections",
  private: "Private",
});

const POST_VISIBILITY_BADGE = Object.freeze({
  public: "badge--info",
  connections: "badge--accent",
  private: "badge--muted",
});

const POST_MOOD_LABELS = Object.freeze({
  none: "",
  celebration: "Celebration",
  question: "Question",
  memory: "Memory",
  announcement: "Announcement",
});

const POST_MOOD_BADGE = Object.freeze({
  celebration: "badge--accent",
  question: "badge--info",
  memory: "badge--muted",
  announcement: "badge--warning",
});

const EVENT_ACCENTS = Object.freeze(["sunrise", "ocean", "violet", "forest"]);

const EVENT_ACCENT_COLORS = Object.freeze({
  sunrise: "var(--event-accent-sunrise)",
  ocean: "var(--event-accent-ocean)",
  violet: "var(--event-accent-violet)",
  forest: "var(--event-accent-forest)",
});

const EVENT_RING_ACCENT_CLASSES = EVENT_ACCENTS.map(
  (accent) => `profile-summary__event-ring--accent-${accent}`
);

const EVENT_VIEW_DURATION_MS = 6000;

const HERO_CARDS = [
  {
    heading: "Know you",
    description:
      "Mark friends and classmates you recognize so chats open with \"This user knows you\".",
  },
  {
    heading: "Want you",
    description:
      "Let someone know you're interested while staying private until you decide to reveal.",
  },
  {
    heading: "Both",
    description:
      "When you both mark Want You the chat celebrates with \"This user both knows and wants you\".",
  },
];

const API_BASE = "/api";
const SESSION_TOKEN_KEY = "wantyou_session_token";
const OWNER_USERNAME = "wantyou";
const USERNAME_CHANGE_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

function buildApiUrl(path) {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function buildProfileUrl(username) {
  const target = username ? `/profile/@${encodeURIComponent(username)}/` : "/profile/";
  return withAiRef(target);
}

function getSessionToken() {
  try {
    return window.localStorage.getItem(SESSION_TOKEN_KEY);
  } catch (error) {
    console.warn("Unable to access session storage", error);
    return null;
  }
}

function setSessionToken(token) {
  try {
    if (token) {
      window.localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch (error) {
    console.warn("Unable to persist session token", error);
  }
}

function clearSessionToken() {
  setSessionToken(null);
}

function updateProfileLinks(username) {
  const target = buildProfileUrl(username);
  document.querySelectorAll("[data-nav-profile]").forEach((anchor) => {
    anchor.setAttribute("href", target);
  });
}

function getNextUsernameChangeAt(changedAt) {
  if (!changedAt) {
    return null;
  }
  const changedTime = Date.parse(changedAt);
  if (Number.isNaN(changedTime)) {
    return null;
  }
  return changedTime + USERNAME_CHANGE_INTERVAL_MS;
}

function setupGlobalControls() {
  const logoutButtons = document.querySelectorAll('[data-action="logout"]');
  if (isAiGuestMode()) {
    logoutButtons.forEach((button) => {
      button.setAttribute("aria-hidden", "true");
      button.hidden = true;
    });
    return;
  }
  logoutButtons.forEach((button) => {
    const control = button;
    control.addEventListener("click", async (event) => {
      event.preventDefault();
      if (control.disabled) {
        return;
      }
      control.disabled = true;
      try {
        await apiRequest("/logout", { method: "POST" });
      } catch (error) {
        if (error?.status !== 401) {
          console.error("Failed to log out", error);
        }
      } finally {
        clearSessionToken();
        updateProfileLinks(null);
        window.location.href = withAiRef("/signup/");
      }
    });
  });
}

async function apiRequest(path, options = {}) {
  let url = buildApiUrl(path);
  const init = { ...options };
  const method = String(init.method || "GET").toUpperCase();
  init.method = method;
  const headers = new Headers(init.headers || {});
  const token = getSessionToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (isAiGuestMode()) {
    if (!isReadOnlyMethod(method)) {
      const error = new Error("Interactions are disabled in AI preview mode.");
      error.status = 403;
      throw error;
    }
    headers.set(AI_GUEST_HEADER, AI_REF_VALUE);
    url = withAiRef(url);
  }
  const hasBody = init.body !== undefined && init.body !== null && !(init.body instanceof FormData);
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  init.headers = headers;

  const response = await fetch(url, init);

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = { message: text };
    }
  }

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearSessionToken();
    }
    const error = new Error(data?.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

const MAX_ALIAS_LENGTH = 40;
const DEFAULT_CONNECTION = {
  status: "none",
  anonymous: false,
  alias: "",
  updatedAt: null,
};

function normalizeConnectionState(state) {
  if (!state) {
    return { ...DEFAULT_CONNECTION };
  }
  return {
    status: state.status ?? "none",
    anonymous: Boolean(state.anonymous),
    alias: typeof state.alias === "string" ? state.alias : "",
    updatedAt: state.updatedAt ?? null,
  };
}

function normalizeMessageEntry(message) {
  if (!message || typeof message !== "object") {
    return null;
  }
  const normalized = { ...message };
  normalized.text = typeof message.text === "string" ? message.text : "";
  normalized.attachments = Array.isArray(message.attachments)
    ? message.attachments
        .map((attachment) => {
          if (!attachment) return null;
          if (typeof attachment === "string") {
            const url = attachment.trim();
            if (!url) {
              return null;
            }
            return { url, type: "image" };
          }
          const url = resolveAttachmentUrl(attachment);
          if (!url) {
            return null;
          }
          const type = getAttachmentType(attachment);
          return {
            ...attachment,
            url,
            type,
            originalName: typeof attachment.originalName === "string" ? attachment.originalName : "",
            mimeType: typeof attachment.mimeType === "string" ? attachment.mimeType : "",
          };
        })
        .filter(Boolean)
    : [];
  normalized.gifUrls = Array.isArray(message.gifUrls)
    ? message.gifUrls
        .map((url) => (typeof url === "string" ? url.trim() : ""))
        .filter((url) => Boolean(url))
    : [];
  normalized.attachmentCount = Number.isFinite(message.attachmentCount)
    ? Math.max(0, Math.floor(message.attachmentCount))
    : normalized.attachments.length;
  normalized.gifCount = Number.isFinite(message.gifCount)
    ? Math.max(0, Math.floor(message.gifCount))
    : normalized.gifUrls.length;
  normalized.reactions = Array.isArray(message.reactions) ? message.reactions : [];
  if (typeof normalized.replyToId === "string") {
    const trimmed = normalized.replyToId.trim();
    if (trimmed) {
      normalized.replyToId = trimmed;
    } else {
      delete normalized.replyToId;
    }
  }
  return normalized;
}

function normalizeThread(thread) {
  if (!thread) return null;
  const unreadCount = Number.isFinite(thread.unreadCount) && thread.unreadCount > 0 ? Math.floor(thread.unreadCount) : 0;
  const totalMessages = Number.isFinite(thread.totalMessages) && thread.totalMessages >= 0
    ? Math.floor(thread.totalMessages)
    : Array.isArray(thread.messages)
    ? thread.messages.length
    : 0;
  const previousCursor = typeof thread.previousCursor === "string" ? thread.previousCursor : null;
  const participants = Array.isArray(thread.participants)
    ? thread.participants
        .map((participant) => {
          if (!participant) return null;
          const username = participant.username ?? participant.id ?? null;
          return {
            username,
            id: participant.id ?? username ?? null,
            displayName:
              participant.displayName ??
              participant.fullName ??
              participant.username ??
              participant.id ??
              "Member",
            fullName: participant.fullName ?? participant.displayName ?? participant.username ?? null,
            nickname: participant.nickname ?? getStoredNickname(username ?? ""),
            role: participant.role ?? "member",
          };
        })
        .filter(Boolean)
    : [];
  const messages = Array.isArray(thread.messages)
    ? thread.messages.map((message) => normalizeMessageEntry(message)).filter(Boolean)
    : [];
  const lastMessage = thread.lastMessage
    ? normalizeMessageEntry(thread.lastMessage)
    : messages[messages.length - 1] ?? null;
  return {
    ...thread,
    inbound: normalizeConnectionState(thread.inbound),
    outbound: normalizeConnectionState(thread.outbound),
    unreadCount,
    totalMessages,
    hasMore: Boolean(thread.hasMore),
    previousCursor,
    participants,
    messages,
    lastMessage,
  };
}

function getDisplayBadges(badges) {
  if (!Array.isArray(badges)) {
    return [];
  }
  const unique = new Set();
  badges.forEach((badge) => {
    if (USER_BADGE_DEFINITIONS[badge]) {
      unique.add(badge);
    }
  });
  return USER_BADGE_ORDER.filter((badge) => unique.has(badge));
}

function renderUserBadges(container, badges) {
  if (!container) return;
  const visibleBadges = getDisplayBadges(badges);
  container.innerHTML = "";
  if (!visibleBadges.length) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  visibleBadges.forEach((badgeName) => {
    const definition = USER_BADGE_DEFINITIONS[badgeName];
    if (!definition) return;
    const badge = document.createElement("span");
    badge.className = `user-badge user-badge--${definition.variant}`;
    if (definition.icon) {
      badge.dataset.icon = definition.icon;
    }
    badge.textContent = definition.label;
    container.appendChild(badge);
  });
}

function loadStoredMap(key) {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (error) {
    // ignore storage issues
  }
  return {};
}

function saveStoredMap(key, value) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // ignore storage issues
  }
}

function getStoredNickname(username) {
  if (!username) return "";
  const map = loadStoredMap(NICKNAME_STORAGE_KEY);
  const value = map[username];
  return typeof value === "string" ? value : "";
}

function setStoredNickname(username, nickname) {
  if (!username) return;
  const map = loadStoredMap(NICKNAME_STORAGE_KEY);
  if (!nickname) {
    delete map[username];
  } else {
    map[username] = nickname;
  }
  saveStoredMap(NICKNAME_STORAGE_KEY, map);
}

function getStoredThreadTheme(username) {
  if (!username) {
    return { background: "default", bubbles: "default" };
  }
  const map = loadStoredMap(THREAD_THEME_STORAGE_KEY);
  const entry = map[username];
  if (!entry || typeof entry !== "object") {
    return { background: "default", bubbles: "default" };
  }
  const backgroundValues = new Set(BACKGROUND_THEME_OPTIONS.map((option) => option.value));
  const bubbleValues = new Set(BUBBLE_THEME_OPTIONS.map((option) => option.value));
  const background = backgroundValues.has(entry.background) ? entry.background : "default";
  const bubbles = bubbleValues.has(entry.bubbles) ? entry.bubbles : "default";
  return { background, bubbles };
}

function saveStoredThreadTheme(username, theme) {
  if (!username || !theme) return;
  const map = loadStoredMap(THREAD_THEME_STORAGE_KEY);
  map[username] = {
    background: theme.background ?? "default",
    bubbles: theme.bubbles ?? "default",
  };
  saveStoredMap(THREAD_THEME_STORAGE_KEY, map);
}

function applyThreadTheme(section, theme) {
  if (!section) return;
  if (theme?.background && theme.background !== "default") {
    section.dataset.backgroundTheme = theme.background;
  } else {
    delete section.dataset.backgroundTheme;
  }
  if (theme?.bubbles && theme.bubbles !== "default") {
    section.dataset.bubbleTheme = theme.bubbles;
  } else {
    delete section.dataset.bubbleTheme;
  }
}

function getThreadDisplayName(thread) {
  if (!thread) return "";
  const inbound = normalizeConnectionState(thread.inbound);
  if (connectionIsAnonymous(inbound)) {
    return thread.displayName;
  }
  const nickname = getStoredNickname(thread.username);
  if (nickname) {
    return nickname;
  }
  return thread.displayName;
}

function formatParticipantName(participant) {
  if (!participant) return "";
  const options = [participant.nickname, participant.displayName, participant.fullName, participant.username];
  for (const value of options) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "Member";
}

function findParticipant(participants, username) {
  if (!Array.isArray(participants) || !username) {
    return null;
  }
  return (
    participants.find((participant) => participant?.username === username) ||
    participants.find((participant) => participant?.id === username) ||
    null
  );
}

function getThreadParticipants(thread) {
  const participants = [];
  if (Array.isArray(thread?.participants)) {
    thread.participants.forEach((participant) => {
      if (!participant) return;
      const key = participant.username || participant.id || participant.displayName;
      if (!key) return;
      const normalized = {
        username: participant.username ?? participant.id ?? null,
        id: participant.id ?? participant.username ?? null,
        displayName: participant.displayName ?? participant.fullName ?? participant.username ?? participant.id ?? "Member",
        fullName: participant.fullName ?? participant.displayName ?? participant.username ?? null,
        nickname: participant.nickname ?? getStoredNickname(participant.username ?? participant.id ?? ""),
        role: participant.role ?? "member",
      };
      if (!participants.some((existing) => existing.username && existing.username === normalized.username)) {
        participants.push(normalized);
      }
    });
  }

  const existingUsernames = new Set(participants.map((participant) => participant.username));
  if (thread?.username && !existingUsernames.has(thread.username)) {
    participants.push({
      username: thread.username,
      displayName: thread.displayName,
      fullName: thread.fullName,
      nickname: getStoredNickname(thread.username),
      role: "member",
    });
  }
  if (sessionUser?.username && !existingUsernames.has(sessionUser.username)) {
    participants.push({
      username: sessionUser.username,
      displayName: sessionUser.fullName ?? sessionUser.username,
      fullName: sessionUser.fullName ?? sessionUser.username,
      nickname: "",
      role: "you",
    });
  }
  return participants;
}

function describeReadReceipt(message, participants) {
  if (!message) return null;
  const recipients = [];
  const sources = Array.isArray(message.readBy)
    ? message.readBy
    : Array.isArray(message.readReceipts)
    ? message.readReceipts
    : [];

  sources.forEach((entry) => {
    if (!entry) return;
    const username = entry.username ?? entry.user ?? entry.userId ?? null;
    const participant = findParticipant(participants, username);
    const name = entry.displayName || entry.name || formatParticipantName(participant);
    const at = entry.readAt ?? entry.seenAt ?? entry.at ?? null;
    if (name) {
      recipients.push({ name, at });
    }
  });

  if (!recipients.length) {
    const participant = participants.find((member) => member.role !== "you");
    const fallbackName = formatParticipantName(participant);
    const at = message.readAt ?? message.seenAt ?? null;
    if (!at && !message.readAt && !message.seenAt) {
      return null;
    }
    recipients.push({ name: fallbackName, at });
  }

  const unique = [];
  const seen = new Set();
  recipients.forEach((recipient) => {
    const key = recipient.name || "Member";
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(recipient);
  });

  if (!unique.length) {
    return null;
  }

  const timestamp =
    unique.find((entry) => Boolean(entry.at))?.at ?? message.readAt ?? message.seenAt ?? null;
  return {
    names: unique.map((entry) => entry.name || "Member"),
    at: timestamp,
  };
}

function formatReadReceiptText(receipt) {
  if (!receipt) return "";
  const names = receipt.names ?? [];
  if (!names.length) return "";
  const visible = names.slice(0, 3);
  let label;
  if (visible.length === 1) {
    label = `Seen by ${visible[0]}`;
  } else if (visible.length === 2) {
    label = `Seen by ${visible[0]} and ${visible[1]}`;
  } else {
    const [first, second, third] = visible;
    label = `Seen by ${first}, ${second}, and ${third}`;
  }
  if (names.length > visible.length) {
    label += ` +${names.length - visible.length}`;
  }
  if (receipt.at) {
    const formatted = formatTimestamp(receipt.at);
    if (formatted) {
      label += ` · ${formatted}`;
    }
  }
  return label;
}

function collectThreadReactions(messages) {
  const counts = new Map();
  (messages ?? []).forEach((message) => {
    const reactions = Array.isArray(message?.reactions) ? message.reactions : [];
    reactions.forEach((reaction) => {
      const emoji = reaction?.emoji ?? reaction?.value;
      if (!emoji) return;
      const amount = Number.isFinite(reaction?.count) ? reaction.count : 1;
      counts.set(emoji, (counts.get(emoji) ?? 0) + amount);
    });
  });
  return counts;
}

function truncateText(value, limit = 120) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, limit - 1))}…`;
}

function promptForCustomNickname(initialNickname = "", targetName = "this member") {
  const initial = typeof initialNickname === "string" ? initialNickname.trim() : "";
  const response = window.prompt(`Set a nickname for ${targetName}`, initial);
  if (response === null) {
    return null;
  }
  const trimmed = response.trim();
  if (!trimmed) {
    if (!initial) {
      window.alert("Nickname cannot be empty.");
      return null;
    }
    const confirmRemoval = window.confirm("Remove this nickname?");
    return confirmRemoval ? "" : null;
  }
  if (trimmed.length > MAX_ALIAS_LENGTH) {
    window.alert(`Nicknames must be ${MAX_ALIAS_LENGTH} characters or fewer.`);
    return null;
  }
  return trimmed;
}

function renderThreadParticipants(listElement, emptyState, participants) {
  if (!listElement) return;
  listElement.innerHTML = "";
  const members = Array.isArray(participants) ? participants : [];
  if (!members.length) {
    if (emptyState) {
      emptyState.hidden = false;
    }
    return;
  }
  if (emptyState) {
    emptyState.hidden = true;
  }
  const fragment = document.createDocumentFragment();
  members.forEach((participant) => {
    const item = document.createElement("li");
    item.className = "thread-participant";
    if (participant.username) {
      item.dataset.username = participant.username;
    }
    const meta = document.createElement("div");
    meta.className = "thread-participant__meta";
    const name = document.createElement("span");
    name.className = "thread-participant__name";
    name.textContent = formatParticipantName(participant);
    meta.appendChild(name);
    const role = document.createElement("span");
    role.className = "thread-participant__role";
    let roleLabel = "Member";
    if (participant.role === "owner") {
      roleLabel = "Owner";
    } else if (participant.role === "admin") {
      roleLabel = "Admin";
    } else if (participant.role === "you") {
      roleLabel = "You";
    }
    role.textContent = roleLabel;
    meta.appendChild(role);
    const storedNickname = participant.nickname ?? getStoredNickname(participant.username ?? "");
    if (storedNickname) {
      const nickname = document.createElement("span");
      nickname.className = "thread-participant__nickname";
      nickname.textContent = `Nickname: ${storedNickname}`;
      meta.appendChild(nickname);
    }
    item.appendChild(meta);
    const actions = document.createElement("div");
    actions.className = "thread-participant__actions";
    if (participant.username && participant.role !== "you") {
      const nicknameButton = document.createElement("button");
      nicknameButton.type = "button";
      nicknameButton.dataset.action = "set-participant-nickname";
      nicknameButton.dataset.username = participant.username;
      nicknameButton.textContent = storedNickname ? "Edit nickname" : "Add nickname";
      actions.appendChild(nicknameButton);
    }
    if (!actions.childElementCount) {
      const placeholder = document.createElement("span");
      placeholder.className = "thread-participant__role";
      placeholder.textContent = "Manage from profile";
      actions.appendChild(placeholder);
    }
    item.appendChild(actions);
    fragment.appendChild(item);
  });
  listElement.appendChild(fragment);
}

function renderReactionSamples(container, counts) {
  if (!container) return;
  container.innerHTML = "";
  const entries = counts && typeof counts.forEach === "function" ? Array.from(counts.entries()) : [];
  if (!entries.length) {
    DEFAULT_REACTION_OPTIONS.slice(0, 5).forEach((emoji) => {
      const item = document.createElement("li");
      item.textContent = emoji;
      container.appendChild(item);
    });
    return;
  }
  entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .forEach(([emoji, count]) => {
      const item = document.createElement("li");
      item.textContent = count > 1 ? `${emoji} ×${count}` : emoji;
      container.appendChild(item);
    });
}

function resolveReplyTarget(message, messageIndex, participants) {
  if (!message) return null;
  let reference = message.replyTo ?? message.parentMessage ?? null;
  if (!reference && typeof message.replyToId === "string") {
    reference = message.replyToId;
  }
  if (typeof reference === "string" && messageIndex instanceof Map) {
    reference = messageIndex.get(reference) ?? reference;
  }
  if (!reference) {
    return null;
  }
  if (typeof reference === "string") {
    return null;
  }
  const targetMessage = reference.message ?? reference;
  if (!targetMessage) {
    return null;
  }
  const sender = targetMessage.sender ?? targetMessage.username ?? null;
  const participant = findParticipant(participants, sender);
  const author = targetMessage.senderDisplayName || targetMessage.displayName || formatParticipantName(participant);
  const previewText = truncateText(
    targetMessage.text || targetMessage.body ||
      (Array.isArray(targetMessage.attachments) && targetMessage.attachments.length
        ? `${targetMessage.attachments.length} attachment${
            targetMessage.attachments.length === 1 ? "" : "s"
          }`
        : "")
  );
  return {
    author: author || "Someone",
    text: previewText || "Attachment",
  };
}

function getLatestReadReceipt(messages, participants) {
  if (!Array.isArray(messages)) {
    return null;
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.sender !== sessionUser?.username) {
      continue;
    }
    const receipt = describeReadReceipt(message, participants);
    if (receipt) {
      return receipt;
    }
  }
  return null;
}

function promptForAlias(currentAlias = "") {
  const initial = typeof currentAlias === "string" ? currentAlias.trim() : "";
  const response = window.prompt(
    `Choose a nickname they'll see (max ${MAX_ALIAS_LENGTH} characters)`,
    initial
  );
  if (response === null) {
    return null;
  }
  const trimmed = response.trim();
  if (!trimmed) {
    window.alert("Nickname cannot be empty when you stay anonymous.");
    return null;
  }
  if (trimmed.length > MAX_ALIAS_LENGTH) {
    window.alert(`Nickname must be ${MAX_ALIAS_LENGTH} characters or fewer.`);
    return null;
  }
  return trimmed;
}

function calculateAgeFromIso(iso) {
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
  const now = new Date();
  let age = now.getFullYear() - year;
  const monthDiff = now.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < day)) {
    age -= 1;
  }
  if (age < 0 || age > 150) {
    return null;
  }
  return age;
}

function promptForBirthdate(initialValue = "") {
  const minAge = 13;
  const maxAge = 120;
  let attempt = typeof initialValue === "string" ? initialValue.trim() : "";
  const message =
    "Enter the member's birthdate to verify them (YYYY-MM-DD). We'll use it for age-based matchmaking.";
  while (true) {
    const response = window.prompt(message, attempt);
    if (response === null) {
      return null;
    }
    const value = response.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      window.alert("Use the YYYY-MM-DD format to verify someone.");
      attempt = value;
      continue;
    }
    const age = calculateAgeFromIso(value);
    if (age === null) {
      window.alert("Enter a real birthdate in the past.");
      attempt = value;
      continue;
    }
    if (age < minAge) {
      window.alert("Verified members must be at least 13 years old.");
      attempt = value;
      continue;
    }
    if (age > maxAge) {
      window.alert("Please enter a realistic birthdate.");
      attempt = value;
      continue;
    }
    return value;
  }
}
let sessionUser = null;

function escapeHtml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveAttachmentUrl(attachment) {
  if (!attachment) {
    return "";
  }
  const directUrl = typeof attachment.url === "string" ? attachment.url.trim() : "";
  if (directUrl) {
    return directUrl;
  }
  const location = typeof attachment.location === "string" ? attachment.location.trim() : "";
  if (!location) {
    return "";
  }
  if (location.startsWith("kv://")) {
    return `/api/media/${location.slice("kv://".length)}`;
  }
  return location;
}

function getAttachmentType(attachment) {
  if (!attachment) {
    return "image";
  }
  if (attachment.type === "video" || attachment.type === "image") {
    return attachment.type;
  }
  const mime = typeof attachment.mimeType === "string" ? attachment.mimeType.toLowerCase() : "";
  if (mime.startsWith("video/")) {
    return "video";
  }
  return "image";
}

function createMediaFragment(attachments = []) {
  const fragment = document.createDocumentFragment();
  attachments.forEach((attachment) => {
    const url = resolveAttachmentUrl(attachment);
    if (!url) {
      return;
    }
    const type = getAttachmentType(attachment);
    if (type === "video") {
      const video = document.createElement("video");
      video.controls = true;
      video.src = url;
      video.preload = "metadata";
      fragment.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.src = url;
      img.alt = attachment?.originalName || "";
      fragment.appendChild(img);
    }
  });
  return fragment;
}

async function loadSession() {
  try {
    const data = await apiRequest("/session");
    sessionUser = data?.user ?? null;
    updateProfileLinks(sessionUser?.username ?? null);
    return sessionUser;
  } catch (error) {
    if (error.status === 401) {
      sessionUser = null;
      updateProfileLinks(null);
    }
    throw error;
  }
}

async function requireSession() {
  if (sessionUser) {
    return sessionUser;
  }
  try {
    return await loadSession();
  } catch (error) {
    if (error.status === 401) {
      if (!isAiGuestMode()) {
        window.location.href = withAiRef("/signup/");
      }
    }
    throw error;
  }
}

function connectionIsAnonymous(state) {
  return (state.status === "want" || state.status === "both") && Boolean(state.anonymous);
}

function describeOutbound(status, anonymous, alias) {
  const nickname = typeof alias === "string" ? alias.trim() : "";
  switch (status) {
    case "know":
      return "You marked that you know them.";
    case "want":
      return anonymous
        ? nickname
          ? `You marked that you want them as “${nickname}” and you're staying anonymous.`
          : "You marked that you want them and you're staying anonymous."
        : "You marked that you want them.";
    case "both":
      return anonymous
        ? nickname
          ? `You marked them as Both as “${nickname}” and you're staying anonymous.`
          : "You marked them as Both and you're staying anonymous."
        : "You marked them as Both.";
    default:
      return "You haven't marked this person yet.";
  }
}

function formatTimestamp(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatRelativeTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const diff = Date.now() - date.getTime();
  if (diff < 0) {
    return date.toLocaleString();
  }
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return date.toLocaleDateString();
}

function formatTimeRemaining(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const diff = date.getTime() - Date.now();
  if (diff <= 0) {
    return "Expired";
  }
  const totalMinutes = Math.floor(diff / 60000);
  if (totalMinutes < 60) {
    return `Expires in ${totalMinutes} min${totalMinutes === 1 ? "" : "s"}`;
  }
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 48) {
    const remainingMinutes = totalMinutes % 60;
    const minuteText = remainingMinutes ? ` ${remainingMinutes} min` : "";
    return `Expires in ${totalHours} h${minuteText}`;
  }
  const days = Math.floor(totalHours / 24);
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

function postSortScore(post) {
  const updated = post?.updatedAt ?? post?.createdAt;
  if (!updated) return 0;
  const time = Date.parse(updated);
  return Number.isNaN(time) ? 0 : time;
}

function sortPostsForDisplay(posts = []) {
  return posts.slice().sort((a, b) => postSortScore(b) - postSortScore(a));
}

function eventSortScore(event) {
  const created = event?.createdAt ?? event?.expiresAt;
  const time = created ? Date.parse(created) : 0;
  return Number.isNaN(time) ? 0 : time;
}

function sortEventsForDisplay(events = []) {
  return events
    .slice()
    .sort((a, b) => {
      if (Boolean(a?.highlighted) !== Boolean(b?.highlighted)) {
        return a.highlighted ? -1 : 1;
      }
      return eventSortScore(b) - eventSortScore(a);
    });
}

function normalizeEventAccent(accent) {
  if (EVENT_ACCENTS.includes(accent)) {
    return accent;
  }
  return EVENT_ACCENTS[0];
}

function tagClassForStatus(status) {
  switch (status) {
    case "both":
      return "tag tag--accent";
    case "know":
      return "tag tag--ghost";
    case "want":
      return "tag";
    default:
      return "tag tag--ghost";
  }
}

function timestampScore(value) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function populateCurrentYears() {
  const currentYear = new Date().getFullYear().toString();
  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = currentYear;
  });
}

function initLanding() {
  const heroCard = document.getElementById("hero-card");
  const form = document.getElementById("request-access");
  let heroIndex = 0;

  const existingToken = getSessionToken();
  if (existingToken) {
    (async () => {
      try {
        await apiRequest("/session");
        window.location.replace(withAiRef("/lookup/"));
      } catch (error) {
        if (error?.status === 401) {
          clearSessionToken();
        } else {
          console.error("Unable to verify existing session", error);
        }
      }
    })();
  }

  if (heroCard) {
    const renderHero = () => {
      const { heading, description } = HERO_CARDS[heroIndex % HERO_CARDS.length];
      heroCard.innerHTML = `
        <div class="hero-card__content">
          <span class="tag">${heading}</span>
          <p>${description}</p>
        </div>
      `;
      heroIndex += 1;
    };

    renderHero();
    setInterval(renderHero, 6000);
  }

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const fullName = formData.get("fullName")?.toString().trim();
      const desiredUsername = formData.get("desiredUsername")?.toString().trim();
      if (!fullName || !desiredUsername) {
        window.alert("Please include your full name and preferred username.");
        return;
      }
      const submitButton = form.querySelector("button[type='submit']");
      submitButton?.setAttribute("disabled", "true");
      try {
        await apiRequest("/request-access", {
          method: "POST",
          body: JSON.stringify({ fullName, desiredUsername }),
        });
        form.classList.add("form--submitted");
        form.innerHTML = `<p class="form__success">Request received! We'll reach out soon.</p>`;
      } catch (error) {
        window.alert(error.message || "We couldn't send your request. Please try again.");
        submitButton?.removeAttribute("disabled");
      }
    });
  }
}

function initSignup() {
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const tabs = document.querySelectorAll(".signup__tab");
  const forms = [signupForm, loginForm].filter(Boolean);

  const activateTab = (target) => {
    if (!forms.length) {
      return;
    }
    const normalizedTarget = forms.some((form) => form.dataset.form === target)
      ? target
      : forms[0].dataset.form;
    tabs.forEach((button) => {
      const isActive = button.dataset.tab === normalizedTarget;
      button.classList.toggle("signup__tab--active", isActive);
    });
    forms.forEach((form) => {
      const isTarget = form.dataset.form === normalizedTarget;
      form.classList.toggle("signup__form--hidden", !isTarget);
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      if (!target) return;
      activateTab(target);
      const params = new URLSearchParams(window.location.search);
      params.set("view", target);
      const nextQuery = params.toString();
      const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
      window.history.replaceState({}, "", nextUrl);
    });
  });

  const params = new URLSearchParams(window.location.search);
  const hashView = window.location.hash ? window.location.hash.slice(1) : "";
  const initialTarget = (params.get("view") || hashView || "").toLowerCase();
  activateTab(initialTarget || (forms[0]?.dataset.form ?? ""));

  signupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!signupForm) return;
    const formData = new FormData(signupForm);
    const fullName = formData.get("fullName")?.toString().trim();
    const username = formData.get("username")?.toString().trim();
    const password = formData.get("password")?.toString();
    if (!fullName || !username || !password) {
      window.alert("Please provide your full name, username, and password.");
      return;
    }
    const submitButton = signupForm.querySelector("button[type='submit']");
    submitButton?.setAttribute("disabled", "true");
    try {
      await apiRequest("/signup", {
        method: "POST",
        body: JSON.stringify({ fullName, username, password }),
      });
      window.alert("Account created! You can log in now.");
      signupForm.reset();
    } catch (error) {
      window.alert(error.message || "We couldn't create your account right now.");
    } finally {
      submitButton?.removeAttribute("disabled");
    }
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!loginForm) return;
    const formData = new FormData(loginForm);
    const username = formData.get("username")?.toString().trim();
    const password = formData.get("password")?.toString();
    if (!username || !password) {
      window.alert("Enter your username and password to continue.");
      return;
    }
    const submitButton = loginForm.querySelector("button[type='submit']");
    submitButton?.setAttribute("disabled", "true");
    try {
      const data = await apiRequest("/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      if (data?.token) {
        setSessionToken(data.token);
      }
      const fullName = data?.user?.fullName ?? username;
      window.alert(`Welcome back, ${fullName}! Redirecting to your lookup.`);
      window.location.href = withAiRef("/lookup/");
    } catch (error) {
      window.alert(error.message || "We couldn't log you in right now.");
    } finally {
      submitButton?.removeAttribute("disabled");
    }
  });
}

function updateBadge(card, status, anonymous) {
  const badge = card.querySelector("[data-badge]");
  if (!badge) return;

  const label = STATUS_LABELS[status] ?? STATUS_LABELS.none;
  badge.textContent = label;
  badge.className = "connection__badge";
  badge.classList.add(`connection__badge--${status}`);

  if ((status === "want" || status === "both") && anonymous) {
    badge.classList.add("connection__badge--anonymous");
  }
}

function updateChips(card, status) {
  card.querySelectorAll("[data-status-button]").forEach((chip) => {
    const value = chip.dataset.statusButton;
    chip.classList.toggle("chip--active", value === status);
  });
}

function updateAnonToggle(card, status, anonymous) {
  const toggle = card.querySelector("[data-anonymous-toggle]");
  if (!toggle) return;
  const canAnonymous = status === "want" || status === "both";
  toggle.checked = canAnonymous && anonymous;
  toggle.disabled = !canAnonymous;
  toggle.closest(".toggle")?.classList.toggle("toggle--disabled", !canAnonymous);
}

function setOutboundNote(card, outbound) {
  const note = card.querySelector("[data-outbound-note]");
  if (!note) return;
  note.textContent = describeOutbound(outbound.status, outbound.anonymous, outbound.alias);
}

function renderCardState(card, inbound, outbound) {
  const normalizedInbound = normalizeConnectionState(inbound);
  const normalizedOutbound = normalizeConnectionState(outbound);
  const displayInbound =
    normalizedInbound.anonymous &&
    (normalizedInbound.status === "want" || normalizedInbound.status === "both")
      ? { ...normalizedInbound, status: "none", anonymous: false }
      : normalizedInbound;
  card.dataset.actualInboundStatus = normalizedInbound.status ?? "none";
  card.dataset.actualInboundAnonymous = String(Boolean(normalizedInbound.anonymous));
  card.dataset.inboundStatus = displayInbound.status ?? "none";
  card.dataset.inboundAnonymous = String(Boolean(displayInbound.anonymous));
  card.dataset.outboundStatus = normalizedOutbound.status ?? "none";
  card.dataset.outboundAnonymous = String(Boolean(normalizedOutbound.anonymous));
  card.dataset.inboundUpdated = normalizedInbound.updatedAt ?? "";
  card.dataset.outboundUpdated = normalizedOutbound.updatedAt ?? "";
  card.dataset.mutualWant = String(
    isWantStatus(normalizedInbound.status) && isWantStatus(normalizedOutbound.status)
  );
  card.dataset.awaitingResponse = String(
    isWantStatus(normalizedInbound.status) && normalizedOutbound.status === "none"
  );
  updateBadge(card, displayInbound.status, displayInbound.anonymous);
  updateChips(card, normalizedOutbound.status);
  updateAnonToggle(card, normalizedOutbound.status, normalizedOutbound.anonymous);
  setOutboundNote(card, normalizedOutbound);
}

function getCardUpdatedTimestamp(card) {
  const inboundUpdated = Date.parse(card.dataset.inboundUpdated ?? "");
  const outboundUpdated = Date.parse(card.dataset.outboundUpdated ?? "");
  const inboundTime = Number.isFinite(inboundUpdated) ? inboundUpdated : 0;
  const outboundTime = Number.isFinite(outboundUpdated) ? outboundUpdated : 0;
  return Math.max(inboundTime, outboundTime);
}

function sortLookupCards(cards, sortValue) {
  if (!cards?.length) {
    return cards;
  }
  const sorted = [...cards];
  switch (sortValue) {
    case "recent":
      sorted.sort((a, b) => getCardUpdatedTimestamp(b) - getCardUpdatedTimestamp(a));
      break;
    case "status":
      sorted.sort((a, b) => {
        const weightA = getStatusWeight(a.dataset.actualInboundStatus ?? "none");
        const weightB = getStatusWeight(b.dataset.actualInboundStatus ?? "none");
        if (weightA !== weightB) {
          return weightA - weightB;
        }
        return a.dataset.name?.localeCompare(b.dataset.name ?? "") ?? 0;
      });
      break;
    case "username":
      sorted.sort((a, b) => (a.dataset.username ?? "").localeCompare(b.dataset.username ?? ""));
      break;
    case "name":
      sorted.sort((a, b) => (a.dataset.name ?? "").localeCompare(b.dataset.name ?? ""));
      break;
    default:
      break;
  }
  return sorted;
}

function applyLookupFilters({
  cards,
  input,
  filterAnon,
  statusFilters,
  mutualOnly,
  hideOutboundNone,
  state,
  emptyState,
  emptyTextWhenNoCards,
}) {
  const query = input?.value.trim().toLowerCase() ?? "";
  const anonOnly = Boolean(filterAnon?.checked);
  const statusSet = statusFilters ? new Set(statusFilters) : null;
  const hasCustomStatusFilter = Boolean(statusSet?.size) && !statusSet.has("all");
  let anyVisible = false;

  cards.forEach((card) => {
    const name = card.dataset.name?.toLowerCase() ?? "";
    const username = card.dataset.username?.toLowerCase() ?? "";
    const usernameKey = card.dataset.username ?? "";
    const entry = state?.get(usernameKey);
    const inboundState = entry ? normalizeConnectionState(entry.inbound) : null;
    const outboundState = entry ? normalizeConnectionState(entry.outbound) : null;
    const inboundStatus = inboundState?.status ?? card.dataset.actualInboundStatus ?? "none";
    const inboundAnonymous = inboundState
      ? Boolean(inboundState.anonymous)
      : card.dataset.actualInboundAnonymous === "true";
    const outboundStatus = outboundState?.status ?? card.dataset.outboundStatus ?? "none";
    const mutualWant = entry
      ? isWantStatus(inboundStatus) && isWantStatus(outboundStatus)
      : card.dataset.mutualWant === "true";
    const matchesQuery = !query || name.includes(query) || username.includes(query);
    const matchesAnon = !anonOnly || (isWantStatus(inboundStatus) && inboundAnonymous);
    const matchesStatus = !hasCustomStatusFilter || statusSet.has(inboundStatus);
    const matchesMutual = !mutualOnly || mutualWant;
    const matchesOutbound = !hideOutboundNone || outboundStatus !== "none";

    if (matchesQuery && matchesAnon && matchesStatus && matchesMutual && matchesOutbound) {
      card.hidden = false;
      anyVisible = true;
    } else {
      card.hidden = true;
    }
  });

  if (emptyState) {
    if (!cards.length) {
      emptyState.textContent = emptyTextWhenNoCards ?? "No people available yet.";
      emptyState.hidden = false;
    } else if (anyVisible) {
      emptyState.hidden = true;
    } else {
      const activeFilters = [];
      if (query) {
        activeFilters.push(`matches for "${query}"`);
      }
      if (anonOnly) {
        activeFilters.push("anonymous admirers");
      }
      if (mutualOnly) {
        activeFilters.push("mutual Want Yous");
      }
      if (hideOutboundNone) {
        activeFilters.push("people you've already marked");
      }
      if (hasCustomStatusFilter && statusSet) {
        const statusDescriptions = [...statusSet]
          .map((status) => STATUS_NAMES[status] ?? status)
          .join(", ")
          .toLowerCase();
        if (statusDescriptions) {
          activeFilters.push(`status: ${statusDescriptions}`);
        }
      }
      emptyState.textContent = query
        ? `No matches for "${query}" yet.`
        : activeFilters.length
        ? `No people match those filters yet (${activeFilters.join(" + ")}).`
        : "No people match those filters yet.";
      emptyState.hidden = false;
    }
  }

  return anyVisible;
}

function updateLookupSummary(summary, state) {
  if (!summary?.card) {
    return;
  }

  const { card, totals = {}, recentSection, recentList, note } = summary;

  if (!state || state.size === 0) {
    card.hidden = true;
    if (recentSection) {
      recentSection.hidden = true;
    }
    if (recentList) {
      recentList.innerHTML = "";
    }
    if (note) {
      note.textContent = "";
    }
    return;
  }

  let total = 0;
  const statusCounts = { none: 0, know: 0, want: 0, both: 0 };
  let mutual = 0;
  let anonymous = 0;
  let awaiting = 0;
  const recent = [];

  state.forEach((entry) => {
    if (!entry) {
      return;
    }
    const inbound = normalizeConnectionState(entry.inbound);
    const outbound = normalizeConnectionState(entry.outbound);
    const element = entry.element;
    const profile = entry.profile ?? {};
    const displayName = profile.fullName ?? element?.dataset?.name ?? "";
    const username = profile.username ?? element?.dataset?.username ?? "";

    total += 1;
    statusCounts[inbound.status] = (statusCounts[inbound.status] ?? 0) + 1;
    if (connectionIsAnonymous(inbound)) {
      anonymous += 1;
    }
    if (isWantStatus(inbound.status) && isWantStatus(outbound.status)) {
      mutual += 1;
    }
    if (isWantStatus(inbound.status) && outbound.status === "none") {
      awaiting += 1;
    }
    const updated = Math.max(
      Date.parse(inbound.updatedAt ?? "") || 0,
      Date.parse(outbound.updatedAt ?? "") || 0
    );
    if (updated > 0) {
      recent.push({
        updated,
        name: displayName,
        username,
        status: inbound.status,
      });
    }
  });

  if (!total) {
    card.hidden = true;
    if (recentSection) {
      recentSection.hidden = true;
    }
    if (recentList) {
      recentList.innerHTML = "";
    }
    if (note) {
      note.textContent = "";
    }
    return;
  }

  card.hidden = false;

  const setTotal = (element, value) => {
    if (element) {
      element.textContent = value;
    }
  };

  setTotal(totals.total, total);
  setTotal(totals.both, statusCounts.both ?? 0);
  setTotal(totals.want, statusCounts.want ?? 0);
  setTotal(totals.know, statusCounts.know ?? 0);
  setTotal(totals.none, statusCounts.none ?? 0);
  setTotal(totals.mutual, mutual);
  setTotal(totals.anon, anonymous);
  setTotal(totals.outbound, awaiting);

  if (recentList) {
    recent.sort((a, b) => b.updated - a.updated);
    const top = recent.slice(0, 3);
    if (top.length) {
      const items = top
        .map((item) => {
          const name = item.name?.trim() || (item.username ? `@${item.username}` : "Someone");
          const statusLabel = STATUS_NAMES[item.status] ?? STATUS_NAMES.none;
          return `
            <li>
              <span>${escapeHtml(name)}</span>
              <span class="tag tag--ghost">${escapeHtml(statusLabel)}</span>
            </li>
          `;
        })
        .join("");
      recentList.innerHTML = items;
      if (recentSection) {
        recentSection.hidden = false;
      }
    } else {
      recentList.innerHTML = "";
      if (recentSection) {
        recentSection.hidden = true;
      }
    }
  }

  if (note) {
    if (mutual > 0) {
      note.textContent = `${formatCount(mutual, "mutual Want You", "mutual Want Yous")} ready to chat.`;
    } else if (awaiting > 0) {
      note.textContent =
        awaiting === 1
          ? "1 person is waiting on you to respond."
          : `${awaiting} people are waiting on you to respond.`;
    } else if (anonymous > 0) {
      note.textContent = `${formatCount(anonymous, "anonymous admirer", "anonymous admirers")} keeping things secret.`;
    } else {
      note.textContent = `${formatCount(total, "person", "people")} in your lookup. Mark someone to open a chat.`;
    }
  }
}

async function initLookup() {
  const container = document.getElementById("lookup-results");
  if (!container) return;

  const searchForm = document.getElementById("lookup-form");
  const searchInput = document.getElementById("lookup-input");
  const filterAnon = document.getElementById("lookup-anon-filter");
  const statusButtons = Array.from(document.querySelectorAll("[data-filter-status]"));
  const mutualFilter = document.getElementById("lookup-mutual-filter");
  const outboundFilter = document.getElementById("lookup-outbound-filter");
  const sortSelect = document.getElementById("lookup-sort");
  const clearFiltersButton = document.querySelector('[data-action="clear-filters"]');
  if (sortSelect && sortSelect.dataset.defaultSort) {
    sortSelect.value = sortSelect.dataset.defaultSort;
  }
  const summaryCard = document.querySelector("[data-lookup-summary]");
  const summaryContext = {
    card: summaryCard,
    totals: {
      total: summaryCard?.querySelector("[data-summary-total]"),
      both: summaryCard?.querySelector("[data-summary-both]"),
      want: summaryCard?.querySelector("[data-summary-want]"),
      know: summaryCard?.querySelector("[data-summary-know]"),
      none: summaryCard?.querySelector("[data-summary-none]"),
      mutual: summaryCard?.querySelector("[data-summary-mutual]"),
      anon: summaryCard?.querySelector("[data-summary-anon]"),
      outbound: summaryCard?.querySelector("[data-summary-outbound]"),
    },
    recentSection: summaryCard?.querySelector("[data-summary-recent]"),
    recentList: summaryCard?.querySelector("[data-summary-recent-list]"),
    note: summaryCard?.querySelector("[data-summary-note]"),
  };

  const surpriseSection = document.querySelector("[data-surprise-section]");
  const surpriseButton = document.querySelector('[data-action="surprise-me"]');
  const surpriseNote = document.querySelector("[data-surprise-note]");

  const cards = [];
  const state = new Map();
  let emptyState = null;
  let latestPeople = [];

  const activeStatusFilters = new Set(["all"]);

  const updateSurpriseAvailability = () => {
    if (!surpriseButton || !surpriseNote) {
      return;
    }
    const badges = sessionUser?.badges ?? [];
    const isVerified = getDisplayBadges(badges).includes("Verified");
    const ageRange = typeof sessionUser?.ageRange === "string" ? sessionUser.ageRange : "";
    if (!isVerified || !ageRange) {
      surpriseButton.disabled = true;
      if (surpriseSection) {
        surpriseSection.dataset.surpriseReady = "false";
      }
      surpriseNote.hidden = false;
      surpriseNote.textContent =
        "Verify with a birthdate to unlock age-based surprise matches.";
      return;
    }
    const candidates = latestPeople.filter((person) => {
      if (!person || !person.ageRange) return false;
      if (person.ageRange !== ageRange) return false;
      return getDisplayBadges(person.badges).includes("Verified");
    });
    if (!candidates.length) {
      surpriseButton.disabled = true;
      if (surpriseSection) {
        surpriseSection.dataset.surpriseReady = "pending";
      }
      surpriseNote.hidden = false;
      surpriseNote.textContent = "No Verified people share your age range yet. Check back soon.";
      return;
    }
    surpriseButton.disabled = false;
    if (surpriseSection) {
      surpriseSection.dataset.surpriseReady = "true";
    }
    surpriseNote.hidden = false;
    surpriseNote.textContent = `We'll highlight a random Verified member aged ${ageRange}.`;
  };

  const updateStatusButtons = () => {
    statusButtons.forEach((button) => {
      const value = button.dataset.filterStatus ?? "all";
      const isActive = activeStatusFilters.has(value);
      button.classList.toggle("chip--active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  };

  const setStatusFilters = (values) => {
    activeStatusFilters.clear();
    values.forEach((value) => {
      if (value) {
        activeStatusFilters.add(value);
      }
    });
    if (!activeStatusFilters.size) {
      activeStatusFilters.add("all");
    }
    updateStatusButtons();
  };

  const toggleStatusFilter = (value) => {
    if (!value) {
      return;
    }
    if (value === "all") {
      setStatusFilters(["all"]);
      refreshFilters();
      return;
    }
    if (activeStatusFilters.has(value)) {
      activeStatusFilters.delete(value);
    } else {
      activeStatusFilters.add(value);
    }
    activeStatusFilters.delete("all");
    if (!activeStatusFilters.size) {
      activeStatusFilters.add("all");
    }
    updateStatusButtons();
    refreshFilters();
  };

  const applySort = () => {
    if (!sortSelect || cards.length === 0) {
      return;
    }
    const sorted = sortLookupCards(cards, sortSelect.value);
    if (!sorted || sorted.length !== cards.length) {
      return;
    }
    let changed = false;
    for (let index = 0; index < sorted.length; index += 1) {
      if (sorted[index] !== cards[index]) {
        changed = true;
        break;
      }
    }
    if (!changed) {
      return;
    }
    cards.length = 0;
    sorted.forEach((card) => {
      cards.push(card);
    });
    const anchor = emptyState && container.contains(emptyState) ? emptyState : null;
    sorted.forEach((card) => {
      if (anchor) {
        container.insertBefore(card, anchor);
      } else {
        container.appendChild(card);
      }
    });
  };

  const refreshSummary = () => {
    updateLookupSummary(summaryContext, state);
  };

  const refreshFilters = () => {
    applySort();
    applyLookupFilters({
      cards,
      input: searchInput,
      filterAnon,
      statusFilters: activeStatusFilters,
      mutualOnly: Boolean(mutualFilter?.checked),
      hideOutboundNone: Boolean(outboundFilter?.checked),
      state,
      emptyState,
      emptyTextWhenNoCards: "No one else has joined yet.",
    });
    refreshSummary();
  };

  const resetFilters = ({ focusSearch = true } = {}) => {
    if (searchInput) {
      searchInput.value = "";
    }
    if (filterAnon) {
      filterAnon.checked = false;
    }
    if (mutualFilter) {
      mutualFilter.checked = false;
    }
    if (outboundFilter) {
      outboundFilter.checked = false;
    }
    if (sortSelect) {
      const defaultSortValue =
        sortSelect.dataset.defaultSort ||
        (sortSelect.options && sortSelect.options.length ? sortSelect.options[0].value : sortSelect.value);
      sortSelect.value = defaultSortValue;
    }
    setStatusFilters(["all"]);
    refreshFilters();
    if (focusSearch && searchInput) {
      searchInput.focus();
    }
  };

  updateStatusButtons();
  refreshSummary();

  container.innerHTML = '<p class="lookup__empty">Loading your people…</p>';

  statusButtons.forEach((button) => {
    const value = button.dataset.filterStatus ?? "all";
    button.addEventListener("click", () => toggleStatusFilter(value));
  });

  const renderPeople = (people) => {
    cards.length = 0;
    state.clear();
    container.innerHTML = "";
    emptyState = document.createElement("p");
    emptyState.className = "lookup__empty";
    emptyState.dataset.empty = "true";
    emptyState.hidden = true;
    latestPeople = Array.isArray(people) ? people.slice() : [];

    const fragment = document.createDocumentFragment();

    people.forEach((person) => {
      const inbound = normalizeConnectionState(person.inbound);
      const outbound = normalizeConnectionState(person.outbound);

      const card = document.createElement("article");
      card.className = "card connection";
      card.dataset.username = person.username;
      card.dataset.name = person.fullName;

      const profilePicture = typeof person.profilePicture === "string" ? person.profilePicture.trim() : "";
      const fallbackAvatar = `https://api.dicebear.com/6.x/initials/svg?seed=${encodeURIComponent(
        person.username
      )}`;
      const avatarSource = profilePicture || fallbackAvatar;
      const profileHref = buildProfileUrl(person.username);
      card.innerHTML = `
        <header class="connection__header">
          <img src="${escapeHtml(avatarSource)}" alt="${escapeHtml(person.fullName)}" />
          <div class="connection__identity">
            <h3 class="connection__name">
              <a href="${profileHref}">${escapeHtml(person.fullName)}</a>
              <span class="user-badges user-badges--inline" data-user-badges hidden></span>
            </h3>
            <p class="connection__username">
              <span>@${escapeHtml(person.username)}</span>
              <button
                type="button"
                class="connection__history-button"
                data-username-history-trigger
                hidden
                aria-label="View previous usernames for ${escapeHtml(person.fullName)}"
                title="View previous usernames"
              >
                ℹ️
              </button>
            </p>
          </div>
          <span class="connection__badge" data-badge></span>
        </header>
        <p class="connection__bio">${
          person.tagline ? escapeHtml(person.tagline) : "No tagline yet."
        }</p>
        <p class="connection__note" data-outbound-note></p>
        <div class="connection__actions">
          <button class="chip" data-status-button="know">Know you</button>
          <button class="chip" data-status-button="want">Want you</button>
          <button class="chip" data-status-button="both">Both</button>
        </div>
        <label class="toggle">
          <input type="checkbox" data-anonymous-toggle />
          <span>Keep Want You anonymous</span>
        </label>
        <button class="button button--ghost" data-chat-button>
          Open chat
        </button>
      `;

      renderUserBadges(card.querySelector("[data-user-badges]"), person.badges);
      renderCardState(card, inbound, outbound);

      const previousUsernames = Array.isArray(person.previousUsernames)
        ? person.previousUsernames.filter((name) => name && name !== person.username)
        : [];
      const historyTrigger = card.querySelector("[data-username-history-trigger]");
      if (historyTrigger) {
        if (previousUsernames.length) {
          historyTrigger.hidden = false;
          historyTrigger.addEventListener("click", () => {
            window.alert(`Previous usernames:\n${previousUsernames.map((name) => `@${name}`).join("\n")}`);
          });
        } else {
          historyTrigger.remove();
        }
      }

      const usernameKey = person.username;
      const profile = { username: person.username, fullName: person.fullName };
      state.set(usernameKey, { inbound, outbound, element: card, profile });

      card.querySelectorAll("[data-status-button]").forEach((button) => {
        button.addEventListener("click", async () => {
          const newStatus = button.dataset.statusButton || "none";
          const entry =
            state.get(usernameKey) ?? {
              inbound: normalizeConnectionState(),
              outbound: normalizeConnectionState(),
              element: card,
              profile,
            };
          const previousInbound = normalizeConnectionState(entry.inbound);
          const previousOutbound = normalizeConnectionState(entry.outbound);
          const canStayAnonymous = newStatus === "want" || newStatus === "both";
          const nextOutbound = {
            ...previousOutbound,
            status: newStatus,
            anonymous: canStayAnonymous ? previousOutbound.anonymous : false,
            alias: canStayAnonymous ? previousOutbound.alias : "",
            updatedAt: new Date().toISOString(),
          };

          state.set(usernameKey, {
            inbound: previousInbound,
            outbound: nextOutbound,
            element: card,
            profile: entry.profile ?? profile,
          });
          renderCardState(card, previousInbound, nextOutbound);
          refreshFilters();

          try {
            const result = await apiRequest("/status", {
              method: "POST",
              body: JSON.stringify({
                targetUsername: usernameKey,
                status: newStatus,
                anonymous: nextOutbound.anonymous,
                alias: nextOutbound.alias,
              }),
            });
            const connection = result?.connection;
            const inboundState = normalizeConnectionState(
              connection?.inbound ?? state.get(usernameKey)?.inbound ?? previousInbound
            );
            const outboundState = normalizeConnectionState(
              connection?.outbound ?? state.get(usernameKey)?.outbound ?? nextOutbound
            );
            state.set(usernameKey, {
              inbound: inboundState,
              outbound: outboundState,
              element: card,
              profile: entry.profile ?? profile,
            });
            renderCardState(card, inboundState, outboundState);
            refreshFilters();
          } catch (error) {
            state.set(usernameKey, {
              inbound: previousInbound,
              outbound: previousOutbound,
              element: card,
              profile: entry.profile ?? profile,
            });
            renderCardState(card, previousInbound, previousOutbound);
            refreshFilters();
            const message =
              error?.status === 401
                ? "Log in to save your Want You updates."
                : error?.message || "We couldn't save that change.";
            window.alert(message);
          }
        });
      });

      const anonToggle = card.querySelector("[data-anonymous-toggle]");
      anonToggle?.addEventListener("change", async () => {
        const entry = state.get(usernameKey);
        if (!entry) return;
        const currentInbound = normalizeConnectionState(entry.inbound);
        const currentOutbound = normalizeConnectionState(entry.outbound);
        const canAnonymous =
          currentOutbound.status === "want" || currentOutbound.status === "both";
        const wantsAnonymous = canAnonymous && anonToggle.checked;
        let aliasValue = currentOutbound.alias;
        if (wantsAnonymous && !aliasValue) {
          const aliasResult = promptForAlias(aliasValue);
          if (aliasResult === null) {
            anonToggle.checked = currentOutbound.anonymous;
            return;
          }
          aliasValue = aliasResult;
        }
        if (!wantsAnonymous) {
          aliasValue = "";
        }
        const nextOutbound = {
          ...currentOutbound,
          anonymous: wantsAnonymous,
          alias: aliasValue,
          updatedAt: new Date().toISOString(),
        };
        state.set(usernameKey, {
          inbound: currentInbound,
          outbound: nextOutbound,
          element: card,
          profile: entry.profile ?? profile,
        });
        renderCardState(card, currentInbound, nextOutbound);
        refreshFilters();

        try {
          const result = await apiRequest("/status", {
            method: "POST",
            body: JSON.stringify({
              targetUsername: usernameKey,
              status: nextOutbound.status,
              anonymous: nextOutbound.anonymous,
              alias: nextOutbound.alias,
            }),
          });
          const connection = result?.connection;
          const inboundState = normalizeConnectionState(
            connection?.inbound ?? state.get(usernameKey)?.inbound ?? currentInbound
          );
          const outboundState = normalizeConnectionState(
            connection?.outbound ?? state.get(usernameKey)?.outbound ?? nextOutbound
          );
          state.set(usernameKey, {
            inbound: inboundState,
            outbound: outboundState,
            element: card,
            profile: entry.profile ?? profile,
          });
          renderCardState(card, inboundState, outboundState);
          refreshFilters();
        } catch (error) {
          state.set(usernameKey, {
            inbound: currentInbound,
            outbound: currentOutbound,
            element: card,
            profile: entry.profile ?? profile,
          });
          renderCardState(card, currentInbound, currentOutbound);
          refreshFilters();
          const message =
            error?.status === 401
              ? "Log in to save your Want You updates."
              : error?.message || "We couldn't update anonymity right now.";
          window.alert(message);
        }
      });

      const chatButton = card.querySelector("[data-chat-button]");
      chatButton?.addEventListener("click", async () => {
        try {
          await requireSession();
        } catch {
          return;
        }
        const entry = state.get(usernameKey);
        if (!entry || entry.outbound.status === "none") {
          window.alert("Choose Know you, Want you, or Both before starting a chat.");
          return;
        }
        try {
          await apiRequest("/messages/selection", {
            method: "POST",
            body: JSON.stringify({
              threadId: usernameKey,
              person: usernameKey,
              name: person.fullName,
              status: entry.outbound.status,
              anonymous: entry.outbound.anonymous,
            }),
          });
        } catch (error) {
          const message =
            error?.status === 401
              ? "Log in to keep track of your chats."
              : error?.message || "We couldn't remember that chat selection.";
          window.alert(message);
        }
        window.location.href = withAiRef("/messages/");
      });

      fragment.appendChild(card);
      cards.push(card);
    });

    fragment.appendChild(emptyState);
    container.appendChild(fragment);

    refreshFilters();
    updateSurpriseAvailability();
  };

  surpriseButton?.addEventListener("click", () => {
    if (surpriseButton.disabled) {
      return;
    }
    const ageRange = typeof sessionUser?.ageRange === "string" ? sessionUser.ageRange : "";
    if (!ageRange) {
      updateSurpriseAvailability();
      return;
    }
    const candidates = latestPeople
      .filter((person) => person && person.username !== sessionUser?.username)
      .filter((person) => person.ageRange === ageRange)
      .filter((person) => getDisplayBadges(person.badges).includes("Verified"));
    if (!candidates.length) {
      window.alert("No Verified people share your age range yet. Check back soon.");
      updateSurpriseAvailability();
      return;
    }
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    let entry = state.get(choice.username);
    if (!entry) {
      window.location.href = buildProfileUrl(choice.username);
      return;
    }
    if (entry.element?.hidden) {
      resetFilters({ focusSearch: false });
      entry = state.get(choice.username);
    }
    const element = entry?.element;
    if (element) {
      window.requestAnimationFrame(() => {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("connection--highlight");
        window.setTimeout(() => {
          element.classList.remove("connection--highlight");
        }, 4000);
      });
      if (surpriseNote) {
        surpriseNote.hidden = false;
        surpriseNote.textContent = `Surprise! We highlighted ${choice.fullName} (${ageRange}). Start a chat from their card.`;
      }
    } else {
      window.location.href = buildProfileUrl(choice.username);
    }
  });

  if (searchForm) {
    searchForm.addEventListener("submit", (event) => event.preventDefault());
  }
  searchInput?.addEventListener("input", () => refreshFilters());
  filterAnon?.addEventListener("change", () => refreshFilters());
  mutualFilter?.addEventListener("change", () => refreshFilters());
  outboundFilter?.addEventListener("change", () => refreshFilters());
  sortSelect?.addEventListener("change", () => refreshFilters());
  clearFiltersButton?.addEventListener("click", () => {
    resetFilters();
  });

  try {
    await requireSession();
  } catch {
    return;
  }

  updateSurpriseAvailability();

  try {
    const data = await apiRequest("/lookup");
    renderPeople(data?.people ?? []);
  } catch (error) {
    console.error("Unable to load lookup", error);
    container.innerHTML = `<p class="lookup__empty">${escapeHtml(
      error?.message || "We couldn't load your people right now."
    )}</p>`;
    cards.length = 0;
    state.clear();
    updateLookupSummary(summaryContext, state);
    latestPeople = [];
    updateSurpriseAvailability();
  }
}

function renderThreadView(context, thread, options = {}) {
  const { preserveScroll = false, previousScrollHeight = 0 } = options;
  const {
    statusHeader,
    statusLabel,
    title,
    threadBadges,
    aliasNote,
    revealToggle,
    switchAnon,
    requestReveal,
    messageLog,
    composer,
    placeholder,
    loadMoreButton,
    threadSection,
    readStatus,
    threadDetails,
    participantsList,
    participantsEmpty,
    nicknameInput,
    nicknameNote,
    nicknameTarget,
    backgroundSelect,
    bubbleSelect,
    reactionSamples,
  } = context;

  const inbound = normalizeConnectionState(thread.inbound);
  const outbound = normalizeConnectionState(thread.outbound);
  const inboundAnonymous = connectionIsAnonymous(inbound);

  placeholder.hidden = true;
  statusHeader.hidden = false;
  composer.hidden = false;

  if (loadMoreButton) {
    const shouldShow = Boolean(thread.hasMore);
    loadMoreButton.hidden = !shouldShow;
    if (shouldShow) {
      loadMoreButton.disabled = Boolean(thread.loadingOlder);
      loadMoreButton.textContent = thread.loadingOlder
        ? "Loading earlier messages..."
        : "Load earlier messages";
    }
  }

  statusLabel.textContent = STATUS_LABELS[inbound.status] ?? STATUS_LABELS.none;
  const displayName = getThreadDisplayName(thread);
  title.textContent = displayName;
  if (threadBadges) {
    if (inboundAnonymous) {
      threadBadges.hidden = true;
      threadBadges.innerHTML = "";
    } else {
      renderUserBadges(threadBadges, thread.badges);
    }
  }

  if (aliasNote) {
    if (outbound.status === "want" || outbound.status === "both") {
      if (outbound.anonymous) {
        const aliasName = escapeHtml(outbound.alias || "Anonymous");
        aliasNote.innerHTML = `They currently see you as <strong>${aliasName}</strong>.`;
      } else {
        const name = escapeHtml(sessionUser?.fullName ?? "You");
        aliasNote.innerHTML = `They see you as <strong>${name}</strong>.`;
      }
      aliasNote.hidden = false;
    } else {
      aliasNote.hidden = true;
    }
  }

  const canReveal = outbound.status === "want" || outbound.status === "both";
  if (revealToggle) {
    revealToggle.disabled = !canReveal;
    revealToggle.checked = canReveal && !outbound.anonymous;
    revealToggle.parentElement?.classList.toggle("toggle--disabled", !canReveal);
  }
  if (switchAnon) {
    switchAnon.disabled = !canReveal;
    if (!canReveal) {
      switchAnon.textContent = "Anonymity not available";
    } else if (outbound.anonymous) {
      switchAnon.textContent = "Reveal yourself";
    } else {
      switchAnon.textContent = "Go anonymous";
    }
  }
  if (requestReveal) {
    requestReveal.disabled = !inboundAnonymous;
  }

  const theme = getStoredThreadTheme(thread.username);
  if (backgroundSelect && backgroundSelect.value !== theme.background) {
    backgroundSelect.value = theme.background;
  }
  if (bubbleSelect && bubbleSelect.value !== theme.bubbles) {
    bubbleSelect.value = theme.bubbles;
  }
  applyThreadTheme(threadSection, theme);

  const participants = getThreadParticipants(thread);
  thread.participants = participants;
  renderThreadParticipants(participantsList, participantsEmpty, participants);

  if (nicknameTarget) {
    nicknameTarget.textContent = thread.displayName;
  }

  if (nicknameInput) {
    const storedNickname = inboundAnonymous ? "" : getStoredNickname(thread.username);
    nicknameInput.value = storedNickname;
    nicknameInput.disabled = inboundAnonymous;
    nicknameInput.placeholder = inboundAnonymous
      ? "Nicknames unavailable while they stay anonymous"
      : "Add a nickname";
    if (nicknameNote) {
      if (inboundAnonymous) {
        nicknameNote.hidden = false;
        nicknameNote.textContent = "Nicknames are hidden until they reveal themselves.";
      } else if (storedNickname) {
        nicknameNote.hidden = false;
        nicknameNote.innerHTML = `Original name: <strong>${escapeHtml(thread.displayName)}</strong>`;
      } else {
        nicknameNote.hidden = true;
      }
    }
  }

  if (threadDetails && !context.detailsVisible) {
    threadDetails.hidden = true;
  }

  const incomingAuthor = inboundAnonymous
    ? inbound.alias?.trim() || "Anonymous"
    : displayName;

  const messages = Array.isArray(thread.messages) ? thread.messages : [];
  if (!Array.isArray(thread.messages)) {
    thread.messages = messages;
  }
  const messageIndex = new Map();
  const fragment = document.createDocumentFragment();

  messages.forEach((message, index) => {
    if (!message) return;
    const normalizedMessage = normalizeMessageEntry(message) ?? {
      ...message,
      attachments: Array.isArray(message.attachments) ? message.attachments : [],
      gifUrls: Array.isArray(message.gifUrls) ? message.gifUrls : [],
    };
    thread.messages[index] = normalizedMessage;
    const messageKey =
      normalizedMessage.id ??
      message.id ??
      normalizedMessage.uuid ??
      message.uuid ??
      normalizedMessage.clientId ??
      message.clientId ??
      `local-${thread.username}-${index}-${normalizedMessage.createdAt ?? message.createdAt ?? Date.now()}`;
    messageIndex.set(messageKey, normalizedMessage);
    const outgoing = normalizedMessage.sender === sessionUser?.username;
    const direction = outgoing ? "outgoing" : "incoming";
    const author = outgoing
      ? "You"
      : normalizedMessage.senderDisplayName ||
        formatParticipantName(findParticipant(participants, normalizedMessage.sender)) ||
        incomingAuthor;
    const timestampText = formatTimestamp(normalizedMessage.createdAt);
    const metaText = `${author}${timestampText ? ` · ${timestampText}` : ""}`;

    const item = document.createElement("li");
    item.className = `message message--${direction}`;
    item.dataset.messageId = messageKey;
    if (normalizedMessage.sender) {
      item.dataset.sender = normalizedMessage.sender;
    }

    const meta = document.createElement("span");
    meta.className = "message__meta";
    meta.textContent = metaText;
    item.appendChild(meta);

    const body = document.createElement("div");
    body.className = "message__body";

    const replyTarget = resolveReplyTarget(normalizedMessage, messageIndex, participants);
    if (replyTarget) {
      const replyBlock = document.createElement("blockquote");
      replyBlock.className = "message__reply";
      replyBlock.innerHTML = `<strong>${escapeHtml(replyTarget.author)}</strong>: ${escapeHtml(
        replyTarget.text
      )}`;
      body.appendChild(replyBlock);
    }

    const text = typeof normalizedMessage.text === "string" ? normalizedMessage.text.trim() : "";
    if (text) {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      body.appendChild(paragraph);
    }

    const attachments = [];
    if (Array.isArray(normalizedMessage.attachments)) {
      normalizedMessage.attachments.forEach((attachment) => {
        if (!attachment) return;
        const url = resolveAttachmentUrl(attachment);
        if (!url) return;
        attachments.push({
          ...attachment,
          url,
          type: getAttachmentType(attachment),
        });
      });
    }
    const gifUrls = [];
    if (Array.isArray(normalizedMessage.gifUrls)) {
      normalizedMessage.gifUrls.forEach((url) => {
        if (typeof url === "string" && url.trim()) {
          gifUrls.push({ url: url.trim(), type: "gif" });
        }
      });
    }
    if (Array.isArray(normalizedMessage.gifs)) {
      normalizedMessage.gifs.forEach((gif) => {
        if (!gif) return;
        if (typeof gif === "string") {
          gifUrls.push({ url: gif, type: "gif" });
        } else if (gif.url) {
          gifUrls.push({ url: gif.url, type: "gif" });
        }
      });
    }
    const media = [...attachments, ...gifUrls].filter((attachment) => attachment?.url);
    if (media.length) {
      const mediaContainer = document.createElement("div");
      mediaContainer.className = "message__attachments";
      mediaContainer.appendChild(createMediaFragment(media));
      body.appendChild(mediaContainer);
    }

    item.appendChild(body);

    const reactions = Array.isArray(normalizedMessage.reactions) ? normalizedMessage.reactions : [];
    if (reactions.length) {
      const reactionList = document.createElement("ul");
      reactionList.className = "message__reactions";
      reactions.forEach((reaction) => {
        if (!reaction) return;
        const emoji = reaction.emoji ?? reaction.value;
        if (!emoji) return;
        const listItem = document.createElement("li");
        listItem.className = "message__reaction";
        const emojiSpan = document.createElement("span");
        emojiSpan.textContent = emoji;
        listItem.appendChild(emojiSpan);
        if (Number.isFinite(reaction.count) && reaction.count > 1) {
          const count = document.createElement("span");
          count.className = "message__reaction-count";
          count.textContent = `×${reaction.count}`;
          listItem.appendChild(count);
        }
        reactionList.appendChild(listItem);
      });
      item.appendChild(reactionList);
    }

    const actions = document.createElement("div");
    actions.className = "message__actions";
    if (!inboundAnonymous || outgoing) {
      const replyButton = document.createElement("button");
      replyButton.type = "button";
      replyButton.className = "message__action";
      replyButton.dataset.action = "reply-to-message";
      replyButton.dataset.messageId = messageKey;
      replyButton.textContent = "Reply";
      actions.appendChild(replyButton);

      const reactButton = document.createElement("button");
      reactButton.type = "button";
      reactButton.className = "message__action";
      reactButton.dataset.action = "react-to-message";
      reactButton.dataset.messageId = messageKey;
      reactButton.textContent = "React";
      actions.appendChild(reactButton);
    }
    if (actions.childElementCount) {
      item.appendChild(actions);
    }

    if (outgoing) {
      const receipt = describeReadReceipt(normalizedMessage, participants);
      const textContent = formatReadReceiptText(receipt);
      if (textContent) {
        const receiptElement = document.createElement("span");
        receiptElement.className = "message__read-receipt";
        receiptElement.textContent = textContent;
        item.appendChild(receiptElement);
      }
    }

    fragment.appendChild(item);
  });

  messageLog.innerHTML = "";
  if (!fragment.childElementCount) {
    const empty = document.createElement("li");
    empty.className = "message message--empty";
    empty.innerHTML = "<p>No messages yet. Say hi!</p>";
    messageLog.appendChild(empty);
  } else {
    messageLog.appendChild(fragment);
  }

  if (reactionSamples) {
    const reactionCounts = collectThreadReactions(messages);
    renderReactionSamples(reactionSamples, reactionCounts);
  }

  if (readStatus) {
    const receipt = getLatestReadReceipt(messages, participants);
    const textContent = formatReadReceiptText(receipt);
    if (textContent) {
      readStatus.hidden = false;
      readStatus.textContent = textContent;
    } else {
      readStatus.hidden = true;
      readStatus.textContent = "";
    }
  }

  if (!preserveScroll && messageLog.scrollHeight) {
    messageLog.scrollTop = messageLog.scrollHeight;
  }
  if (preserveScroll && messageLog.scrollHeight) {
    const delta = messageLog.scrollHeight - previousScrollHeight;
    if (delta > 0) {
      messageLog.scrollTop = delta;
    }
  }

  context.messageIndex = messageIndex;
  context.participants = participants;
  if (typeof context.updateAttachmentPreview === "function") {
    context.updateAttachmentPreview();
  }
  if (typeof context.updateReplyPreview === "function") {
    context.updateReplyPreview();
  }
}

async function initMessages() {
  const list = document.getElementById("conversation-list");
  const threadSection = document.getElementById("messages-thread");
  if (!list || !threadSection) return;

  const statusHeader = threadSection.querySelector("[data-status-bar]");
  const statusLabel = threadSection.querySelector(".messages-thread__status");
  const title = threadSection.querySelector(".messages-thread__title");
  const threadBadges = threadSection.querySelector("[data-thread-badges]");
  const aliasNote = threadSection.querySelector("[data-alias]");
  const revealToggle = document.getElementById("reveal-toggle");
  const switchAnon = threadSection.querySelector('[data-action="switch-anon"]');
  const requestReveal = threadSection.querySelector('[data-action="request-reveal"]');
  const messageLog = document.getElementById("message-log");
  const composer = document.getElementById("message-composer");
  const input = document.getElementById("message-input");
  const placeholder = threadSection.querySelector("[data-thread-placeholder]");
  const newChatButton = document.querySelector('[data-action="new-chat"]');
  const newGroupChatButton = document.querySelector('[data-action="new-group-chat"]');
  const loadMoreButton = threadSection.querySelector('[data-action="load-more"]');
  const searchInput = document.querySelector('.app-search input[type="search"]');
  const readStatus = threadSection.querySelector("[data-thread-read-status]");
  const threadDetails = threadSection.querySelector("[data-thread-details]");
  const participantsList = threadDetails?.querySelector("[data-thread-participants]");
  const participantsEmpty = threadDetails?.querySelector("[data-thread-participants-empty]");
  const nicknameInput = threadDetails?.querySelector("[data-thread-nickname]");
  const nicknameNote = threadDetails?.querySelector("[data-nickname-note]");
  const nicknameTarget = threadDetails?.querySelector("[data-nickname-target]");
  const backgroundSelect = threadDetails?.querySelector("[data-thread-background]");
  const bubbleSelect = threadDetails?.querySelector("[data-thread-bubbles]");
  const reactionSamples = threadDetails?.querySelector("[data-reaction-samples]");
  const closeDetailsButton = threadDetails?.querySelector('[data-action="close-thread-details"]');
  const manageParticipantsButton = threadDetails?.querySelector('[data-action="manage-participants"]');
  const shareInviteButton = threadDetails?.querySelector('[data-action="share-invite"]');
  const emojiPicker = composer?.querySelector("[data-emoji-picker]");
  const emojiSurface = emojiPicker?.querySelector("[data-emoji-surface]") ?? emojiPicker;
  const emojiButton = composer?.querySelector('[data-action="composer-emoji"]');
  const gifButton = composer?.querySelector('[data-action="composer-gif"]');
  const gifPicker = composer?.querySelector("[data-gif-picker]");
  const gifSearchForm = gifPicker?.querySelector("[data-gif-search]");
  const gifSearchInput = gifPicker?.querySelector("[data-gif-search-input]");
  const gifResults = gifPicker?.querySelector("[data-gif-results]");
  const gifStatus = gifPicker?.querySelector("[data-gif-status]");
  const gifMoreButton = gifPicker?.querySelector('[data-action="more-gifs"]');
  const gifCloseButton = gifPicker?.querySelector('[data-action="close-gif-picker"]');
  const themeToggleButton = composer?.querySelector('[data-action="composer-theme"]');
  const replyPreview = composer?.querySelector("[data-reply-preview]");
  const replyAuthor = composer?.querySelector("[data-reply-author]");
  const replyText = composer?.querySelector("[data-reply-text]");
  const cancelReply = composer?.querySelector('[data-action="cancel-reply"]');
  const attachmentPreview = composer?.querySelector("[data-attachment-preview]");
  const imageInput = composer?.querySelector('input[data-upload="image"]');
  const videoInput = composer?.querySelector('input[data-upload="video"]');
  if (!statusHeader || !statusLabel || !title || !messageLog || !composer || !placeholder) {
    return;
  }

  composer.noValidate = true;
  if (input) {
    try {
      input.required = false;
      input.removeAttribute("required");
    } catch (error) {
      // Ignore if the attribute is already absent or cannot be removed.
    }
  }

  newChatButton?.addEventListener("click", (event) => {
    event.preventDefault();
    window.location.href = withAiRef("/lookup/");
  });

  newGroupChatButton?.addEventListener("click", (event) => {
    event.preventDefault();
    window.location.href = withAiRef("/messages/new?group=1");
  });

  const composerState = {
    attachments: [],
    gifs: [],
    replyTo: null,
  };

  const setGifStatus = (message) => {
    if (!gifStatus) return;
    gifStatus.textContent = message || "";
  };

  const updateAttachmentPreview = () => {
    if (!attachmentPreview) return;
    const items = [...composerState.attachments, ...composerState.gifs];
    if (!items.length) {
      attachmentPreview.innerHTML = "";
      attachmentPreview.hidden = true;
      return;
    }
    attachmentPreview.hidden = false;
    attachmentPreview.innerHTML = "";
    items.forEach((item) => {
      const element = document.createElement("li");
      element.className = "composer__attachment";
      element.dataset.attachmentId = item.id;

      if (item.kind === "gif" && item.preview) {
        const previewImage = document.createElement("img");
        previewImage.className = "composer__attachment-thumb";
        previewImage.src = item.preview;
        previewImage.alt = item.name ? `${item.name} GIF preview` : "Selected GIF preview";
        previewImage.loading = "lazy";
        element.appendChild(previewImage);
      }

      const info = document.createElement("div");
      info.className = "composer__attachment-info";
      const name = document.createElement("span");
      name.className = "composer__attachment-name";
      if (item.kind === "gif") {
        name.textContent = item.name || "GIF";
      } else {
        name.textContent = item.file?.name || item.name || "Attachment";
      }
      const meta = document.createElement("span");
      meta.className = "composer__attachment-meta";
      if (item.kind === "gif") {
        meta.textContent = item.provider || truncateText(item.url ?? "", 36);
      } else if (item.file) {
        meta.textContent = formatFileSize(item.file.size);
      } else if (item.size) {
        meta.textContent = formatFileSize(item.size);
      } else {
        meta.textContent = "Attached";
      }
      info.appendChild(name);
      info.appendChild(meta);
      element.appendChild(info);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "composer__attachment-remove";
      removeButton.dataset.action = "remove-attachment";
      removeButton.dataset.attachmentId = item.id;
      removeButton.textContent = "Remove";
      element.appendChild(removeButton);

      attachmentPreview.appendChild(element);
    });
  };

  const updateReplyPreview = () => {
    if (!replyPreview || !replyAuthor || !replyText) return;
    if (!composerState.replyTo) {
      replyPreview.hidden = true;
      replyAuthor.textContent = "";
      replyText.textContent = "";
      return;
    }
    replyPreview.hidden = false;
    replyAuthor.textContent = composerState.replyTo.author;
    replyText.textContent = composerState.replyTo.text;
  };

  const resetComposerState = () => {
    composerState.attachments = [];
    composerState.gifs = [];
    composerState.replyTo = null;
    updateAttachmentPreview();
    updateReplyPreview();
  };

  const addFileAttachments = (fileList, kind) => {
    const files = Array.from(fileList || []);
    files.forEach((file) => {
      composerState.attachments.push({
        id: `${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        file,
        kind,
      });
    });
    updateAttachmentPreview();
  };

  const addGifAttachment = (gif) => {
    if (!gif) return;
    const normalizedUrl = typeof gif === "string" ? gif.trim() : String(gif.url ?? "").trim();
    if (!normalizedUrl) {
      return;
    }
    const alreadyAdded = composerState.gifs.some((item) => item.url === normalizedUrl);
    if (alreadyAdded) {
      if (gifPicker && !gifPicker.hidden) {
        setGifStatus?.("You already attached that GIF.");
      }
      return;
    }
    composerState.gifs.push({
      id: `gif-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      url: normalizedUrl,
      preview: typeof gif === "string" ? undefined : gif.preview || gif.tiny || normalizedUrl,
      name: typeof gif === "string" ? "GIF" : gif.name || gif.description || "GIF",
      provider: typeof gif === "string" ? undefined : gif.provider || "Tenor",
      kind: "gif",
    });
    updateAttachmentPreview();
  };

  const gifState = {
    query: "",
    next: null,
    loading: false,
    initialized: false,
  };

  const renderGifResults = (items, { append = false } = {}) => {
    if (!gifResults) return;
    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const mediaFormats = (() => {
        if (item?.media_formats && typeof item.media_formats === "object") {
          return item.media_formats;
        }
        if (Array.isArray(item?.media) && item.media.length) {
          return item.media[0] || {};
        }
        return {};
      })();
      const fullUrl =
        mediaFormats.gif?.url ||
        mediaFormats.mediumgif?.url ||
        mediaFormats.loopedmp4?.url ||
        item?.url ||
        "";
      const previewUrl =
        mediaFormats.tinygif?.url ||
        mediaFormats.nanogif?.url ||
        mediaFormats.gifpreview?.url ||
        mediaFormats.mediumgif?.url ||
        fullUrl;
      if (!fullUrl) {
        return;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gif-picker__result";
      button.dataset.gifChoice = "1";
      button.dataset.gifUrl = fullUrl;
      if (previewUrl) {
        button.dataset.gifPreview = previewUrl;
      }
      if (item?.id) {
        button.dataset.gifId = item.id;
      }
      const description = item?.content_description || item?.title || "GIF";
      button.dataset.gifDescription = description;
      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = previewUrl || fullUrl;
      img.alt = description ? `${description} GIF` : "GIF preview";
      button.appendChild(img);
      fragment.appendChild(button);
    });
    if (!append) {
      gifResults.innerHTML = "";
    }
    gifResults.appendChild(fragment);
  };

  const fetchGifResults = async ({ query = "", next = null, append = false } = {}) => {
    if (!gifPicker || gifState.loading) {
      return;
    }
    if (!TENOR_API_KEY) {
      setGifStatus("Add a Tenor API key to enable GIF search.");
      if (gifMoreButton) {
        gifMoreButton.hidden = true;
      }
      return;
    }
    gifState.loading = true;
    gifState.query = query;
    const params = new URLSearchParams({
      key: TENOR_API_KEY,
      limit: String(TENOR_SEARCH_LIMIT),
      media_filter: "minimal",
      contentfilter: "high",
    });
    if (TENOR_CLIENT_KEY) {
      params.set("client_key", TENOR_CLIENT_KEY);
    }
    if (query) {
      params.set("q", query);
    }
    if (next) {
      params.set("pos", next);
    }
    const endpoint = query ? "search" : "featured";
    setGifStatus(query ? `Searching “${query}”…` : "Loading trending GIFs…");
    try {
      const response = await fetch(`${TENOR_API_ENDPOINT}/${endpoint}?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Tenor request failed with status ${response.status}`);
      }
      const payload = await response.json();
      const results = Array.isArray(payload?.results) ? payload.results : [];
      renderGifResults(results, { append });
      gifState.next = payload?.next ?? null;
      if (!results.length) {
        setGifStatus(query ? "No GIFs found. Try another search." : "No GIFs to show right now. Try searching instead.");
      } else {
        setGifStatus("");
      }
      if (gifMoreButton) {
        gifMoreButton.hidden = !gifState.next;
      }
      gifState.initialized = true;
    } catch (error) {
      console.error("Unable to load GIFs", error);
      if (!append && gifResults) {
        gifResults.innerHTML = "";
      }
      setGifStatus("We couldn’t load GIFs right now. Try again.");
      gifState.next = null;
      if (gifMoreButton) {
        gifMoreButton.hidden = true;
      }
    } finally {
      gifState.loading = false;
    }
  };

  const ensureGifResults = async () => {
    if (!gifPicker) return;
    if (!gifState.initialized && !gifState.loading) {
      await fetchGifResults({ query: "", append: false });
    }
  };

  function hideGifPicker() {
    if (!gifPicker) return;
    if (!gifPicker.hidden) {
      gifPicker.hidden = true;
      gifButton?.setAttribute("aria-expanded", "false");
      setGifStatus("");
    }
  }

  async function showGifPicker() {
    if (!gifPicker || !gifButton) return;
    hideEmojiPicker();
    gifPicker.hidden = false;
    gifButton.setAttribute("aria-expanded", "true");
    await ensureGifResults();
    if (gifSearchInput) {
      gifSearchInput.focus();
      gifSearchInput.select();
    }
  }

  async function toggleGifPicker() {
    if (!gifPicker || !gifButton) return;
    if (gifPicker.hidden) {
      await showGifPicker();
    } else {
      hideGifPicker();
    }
  }

  async function waitForEmojiPicker() {
    if (!window.customElements) {
      return;
    }
    if (window.customElements.get("emoji-picker")) {
      return;
    }
    if (typeof window.customElements.whenDefined === "function") {
      try {
        await window.customElements.whenDefined("emoji-picker");
      } catch (error) {
        // Ignore failures; the picker will fallback to native emoji input.
      }
    }
  }

  function hideEmojiPicker() {
    if (!emojiPicker) return;
    if (!emojiPicker.hidden) {
      emojiPicker.hidden = true;
      emojiButton?.setAttribute("aria-expanded", "false");
    }
  }

  async function toggleEmojiPicker() {
    if (!emojiPicker || !emojiButton) return;
    const willShow = Boolean(emojiPicker.hidden);
    if (willShow) {
      await waitForEmojiPicker();
      hideGifPicker();
    }
    emojiPicker.hidden = !willShow;
    emojiButton.setAttribute("aria-expanded", String(willShow));
    if (willShow && emojiSurface && typeof emojiSurface.focus === "function") {
      emojiSurface.focus();
    }
  }

  let activeReactionPicker = null;

  const closeReactionPicker = () => {
    if (activeReactionPicker) {
      activeReactionPicker.remove();
      activeReactionPicker = null;
    }
  };

  updateAttachmentPreview();
  updateReplyPreview();
  placeholder.hidden = false;
  statusHeader.hidden = true;
  composer.hidden = true;

  try {
    await requireSession();
  } catch {
    return;
  }

  let threads = [];
  const threadMap = new Map();
  let activeThread = null;
  let loadingThread = false;
  let loadingOlderMessages = false;
  let searchTerm = "";

  const MESSAGE_PAGE_SIZE = 50;

  const context = {
    statusHeader,
    statusLabel,
    title,
    threadBadges,
    aliasNote,
    revealToggle,
    switchAnon,
    requestReveal,
    messageLog,
    composer,
    placeholder,
    loadMoreButton,
    threadSection,
    readStatus,
    threadDetails,
    participantsList,
    participantsEmpty,
    nicknameInput,
    nicknameNote,
    nicknameTarget,
    backgroundSelect,
    bubbleSelect,
    reactionSamples,
    updateAttachmentPreview,
    updateReplyPreview,
    detailsVisible: false,
    messageIndex: new Map(),
    participants: [],
  };

  if (backgroundSelect && !backgroundSelect.options.length) {
    BACKGROUND_THEME_OPTIONS.forEach((option) => {
      const choice = document.createElement("option");
      choice.value = option.value;
      choice.textContent = option.label;
      backgroundSelect.appendChild(choice);
    });
    backgroundSelect.value = "default";
  }

  if (bubbleSelect && !bubbleSelect.options.length) {
    BUBBLE_THEME_OPTIONS.forEach((option) => {
      const choice = document.createElement("option");
      choice.value = option.value;
      choice.textContent = option.label;
      bubbleSelect.appendChild(choice);
    });
    bubbleSelect.value = "default";
  }

  if (reactionSamples) {
    renderReactionSamples(reactionSamples, new Map());
  }

  backgroundSelect?.addEventListener("change", () => {
    const value = backgroundSelect.value || "default";
    if (activeThread) {
      const currentTheme = getStoredThreadTheme(activeThread.username);
      const nextTheme = { background: value, bubbles: currentTheme.bubbles };
      saveStoredThreadTheme(activeThread.username, nextTheme);
      applyThreadTheme(threadSection, nextTheme);
    } else {
      applyThreadTheme(threadSection, { background: value, bubbles: bubbleSelect?.value || "default" });
    }
  });

  bubbleSelect?.addEventListener("change", () => {
    const value = bubbleSelect.value || "default";
    if (activeThread) {
      const currentTheme = getStoredThreadTheme(activeThread.username);
      const nextTheme = { background: currentTheme.background, bubbles: value };
      saveStoredThreadTheme(activeThread.username, nextTheme);
      applyThreadTheme(threadSection, nextTheme);
    } else {
      applyThreadTheme(threadSection, { background: backgroundSelect?.value || "default", bubbles: value });
    }
  });

  imageInput?.addEventListener("change", () => {
    addFileAttachments(imageInput.files, "image");
    if (imageInput.value) {
      imageInput.value = "";
    }
  });

  videoInput?.addEventListener("change", () => {
    addFileAttachments(videoInput.files, "video");
    if (videoInput.value) {
      videoInput.value = "";
    }
  });

  attachmentPreview?.addEventListener("click", (event) => {
    const target = event.target;
    const button = target?.closest?.('[data-action="remove-attachment"]');
    if (!button) return;
    const id = button.dataset.attachmentId;
    composerState.attachments = composerState.attachments.filter((item) => item.id !== id);
    composerState.gifs = composerState.gifs.filter((item) => item.id !== id);
    updateAttachmentPreview();
  });

  gifButton?.addEventListener("click", (event) => {
    event.preventDefault();
    toggleGifPicker();
  });

  emojiButton?.addEventListener("click", (event) => {
    event.preventDefault();
    toggleEmojiPicker();
  });

  emojiPicker?.addEventListener("emoji-click", (event) => {
    if (!input) return;
    const detail = event.detail ?? {};
    let emoji = detail.unicode || detail.emoji?.unicode || detail.emoji || "";
    if (Array.isArray(emoji)) {
      emoji = emoji[0] ?? "";
    }
    if (!emoji || typeof emoji !== "string") {
      return;
    }
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const text = input.value ?? "";
    input.value = `${text.slice(0, start)}${emoji}${text.slice(end)}`;
    const nextCursor = start + emoji.length;
    input.focus();
    try {
      input.setSelectionRange(nextCursor, nextCursor);
    } catch (error) {
      // ignore selection errors in older browsers
    }
  });

  gifSearchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (gifState.loading) return;
    const query = gifSearchInput?.value?.trim() ?? "";
    gifState.next = null;
    fetchGifResults({ query, append: false });
  });

  gifSearchInput?.addEventListener("input", (event) => {
    const value = event.target?.value ?? "";
    if (!value.trim() && gifState.query && !gifState.loading) {
      gifState.next = null;
      fetchGifResults({ query: "", append: false });
    }
  });

  gifResults?.addEventListener("click", (event) => {
    const choice = event.target?.closest?.("[data-gif-choice]");
    if (!choice) return;
    event.preventDefault();
    const url = choice.dataset.gifUrl || "";
    if (!url) return;
    addGifAttachment({
      url,
      preview: choice.dataset.gifPreview || url,
      name: choice.dataset.gifDescription || "GIF",
      description: choice.dataset.gifDescription || "GIF",
      provider: "Tenor",
    });
    hideGifPicker();
  });

  gifMoreButton?.addEventListener("click", (event) => {
    event.preventDefault();
    if (!gifState.next || gifState.loading) return;
    fetchGifResults({ query: gifState.query, next: gifState.next, append: true });
  });

  gifCloseButton?.addEventListener("click", (event) => {
    event.preventDefault();
    hideGifPicker();
  });

  cancelReply?.addEventListener("click", (event) => {
    event.preventDefault();
    composerState.replyTo = null;
    updateReplyPreview();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (emojiPicker && !emojiPicker.hidden) {
      if (!emojiPicker.contains(target) && !emojiButton?.contains(target)) {
        hideEmojiPicker();
      }
    }
    if (gifPicker && !gifPicker.hidden) {
      if (!gifPicker.contains(target) && !gifButton?.contains(target)) {
        hideGifPicker();
      }
    }
    if (activeReactionPicker && !activeReactionPicker.contains(target)) {
      if (!target.closest('[data-action="react-to-message"]')) {
        closeReactionPicker();
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const pickerWasOpen = (!emojiPicker?.hidden) || (!gifPicker?.hidden) || Boolean(activeReactionPicker);
      if (pickerWasOpen) {
        event.stopPropagation();
      }
      hideEmojiPicker();
      hideGifPicker();
      closeReactionPicker();
    }
  });

  const openThreadDetails = () => {
    if (!threadDetails) return;
    context.detailsVisible = true;
    threadDetails.hidden = false;
  };

  const closeThreadDetails = () => {
    if (!threadDetails) return;
    context.detailsVisible = false;
    threadDetails.hidden = true;
  };

  themeToggleButton?.addEventListener("click", (event) => {
    event.preventDefault();
    if (!threadDetails) return;
    if (context.detailsVisible) {
      closeThreadDetails();
    } else {
      openThreadDetails();
    }
  });

  closeDetailsButton?.addEventListener("click", (event) => {
    event.preventDefault();
    closeThreadDetails();
  });

  manageParticipantsButton?.addEventListener("click", () => {
    window.alert("Group member management is coming soon. For now, invite friends with the share link.");
  });

  const copyInviteLink = async (link) => {
    if (!link) return "error";
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(link);
        return "clipboard";
      } catch (error) {
        // continue to fallbacks
      }
    }
    const tempInput = document.createElement("input");
    tempInput.type = "text";
    tempInput.value = link;
    tempInput.setAttribute("aria-hidden", "true");
    tempInput.style.position = "fixed";
    tempInput.style.opacity = "0";
    document.body.appendChild(tempInput);
    let copied = false;
    try {
      tempInput.focus();
      tempInput.select();
      if (typeof document.execCommand === "function") {
        copied = document.execCommand("copy");
      }
    } catch (error) {
      copied = false;
    }
    document.body.removeChild(tempInput);
    if (copied) {
      return "execCommand";
    }
    return "prompt";
  };

  shareInviteButton?.addEventListener("click", async () => {
    if (!activeThread) {
      window.alert("Open a conversation to share an invite link.");
      return;
    }
    const inviteLink = `${window.location.origin}/messages/thread/${encodeURIComponent(activeThread.username)}`;
    const method = await copyInviteLink(inviteLink);
    if (method === "clipboard" || method === "execCommand") {
      window.alert("Invite link copied to your clipboard!");
      return;
    }
    window.prompt("Copy this invite link", inviteLink);
  });

  participantsList?.addEventListener("click", (event) => {
    const button = event.target?.closest?.('[data-action="set-participant-nickname"]');
    if (!button || !activeThread) return;
    const username = button.dataset.username;
    const participant = findParticipant(context.participants, username);
    const currentNickname = getStoredNickname(username);
    const response = promptForCustomNickname(currentNickname, formatParticipantName(participant));
    if (response === null) {
      return;
    }
    setStoredNickname(username, response);
    renderThreadView(context, activeThread, {
      preserveScroll: true,
      previousScrollHeight: messageLog.scrollHeight,
    });
    attachThreadControls(activeThread);
    renderList();
  });

  const saveNicknameInput = () => {
    if (!nicknameInput || !activeThread) return;
    const inboundState = normalizeConnectionState(activeThread.inbound);
    if (connectionIsAnonymous(inboundState)) {
      return;
    }
    const value = nicknameInput.value.trim();
    setStoredNickname(activeThread.username, value);
    renderThreadView(context, activeThread, {
      preserveScroll: true,
      previousScrollHeight: messageLog.scrollHeight,
    });
    attachThreadControls(activeThread);
    renderList();
  };

  nicknameInput?.addEventListener("change", saveNicknameInput);
  nicknameInput?.addEventListener("blur", saveNicknameInput);

  messageLog?.addEventListener("click", (event) => {
    const replyButton = event.target?.closest?.('[data-action="reply-to-message"]');
    if (replyButton) {
      const messageId = replyButton.dataset.messageId;
      if (!messageId) return;
      const message = context.messageIndex?.get(messageId);
      if (!message || !input) return;
      const participant = findParticipant(context.participants, message.sender);
      const authorName =
        message.sender === sessionUser?.username
          ? "You"
          : formatParticipantName(participant) || context.title?.textContent || "Someone";
      let preview = message.text || "";
      if (!preview) {
        const attachmentCount = Array.isArray(message.attachments) ? message.attachments.length : 0;
        const gifCount = Array.isArray(message.gifUrls) ? message.gifUrls.length : 0;
        const totalMedia = attachmentCount + gifCount;
        if (totalMedia > 0) {
          preview = `${totalMedia} attachment${totalMedia === 1 ? "" : "s"}`;
        }
      }
      composerState.replyTo = {
        id: messageId,
        author: authorName,
        text: truncateText(preview || "Attachment"),
      };
      updateReplyPreview();
      input.focus();
      return;
    }

    const reactButton = event.target?.closest?.('[data-action="react-to-message"]');
    if (reactButton) {
      event.preventDefault();
      const messageElement = reactButton.closest(".message");
      const messageId = reactButton.dataset.messageId;
      if (!messageElement || !messageId) return;
      if (activeReactionPicker && activeReactionPicker.parentElement === messageElement) {
        closeReactionPicker();
        return;
      }
      closeReactionPicker();
      const picker = document.createElement("div");
      picker.className = "message__reaction-picker";
      DEFAULT_REACTION_OPTIONS.forEach((emoji) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.reactionOption = emoji;
        button.textContent = emoji;
        picker.appendChild(button);
      });
      messageElement.appendChild(picker);
      activeReactionPicker = picker;
      return;
    }

    const reactionChoice = event.target?.closest?.('[data-reaction-option]');
    if (reactionChoice) {
      const emoji = reactionChoice.dataset.reactionOption || reactionChoice.textContent || "";
      const messageElement = reactionChoice.closest(".message");
      const messageId = messageElement?.dataset.messageId;
      if (!emoji || !messageId || !activeThread) return;
      closeReactionPicker();
      const targetMessage = context.messageIndex?.get(messageId);
      if (!targetMessage) return;
      const reactions = Array.isArray(targetMessage.reactions)
        ? targetMessage.reactions.slice()
        : [];
      const existing = reactions.find((reaction) => reaction?.emoji === emoji || reaction?.value === emoji);
      if (existing) {
        existing.count = Number.isFinite(existing.count) ? existing.count + 1 : 2;
        existing.emoji = emoji;
      } else {
        reactions.push({ emoji, count: 1 });
      }
      targetMessage.reactions = reactions;
      renderThreadView(context, activeThread, {
        preserveScroll: true,
        previousScrollHeight: messageLog.scrollHeight,
      });
      attachThreadControls(activeThread);
    }
  });

  const fetchThreads = async () => {
    const data = await apiRequest("/messages/threads");
    return (data?.threads ?? []).map((thread) => normalizeThread(thread));
  };

  const fetchThreadDetail = async (username, { cursor } = {}) => {
    const params = new URLSearchParams();
    params.set("limit", MESSAGE_PAGE_SIZE);
    if (cursor) {
      params.set("cursor", cursor);
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await apiRequest(`/messages/thread/${encodeURIComponent(username)}${query}`);
    return normalizeThread(data?.thread ?? null);
  };

  const updateListSelection = (username) => {
    list.querySelectorAll(".messages-list__item").forEach((item) => {
      const isActive = item.dataset.thread === username;
      item.setAttribute("aria-current", String(isActive));
      item.classList.toggle("messages-list__item--active", isActive);
    });
  };

  const renderList = () => {
    list.innerHTML = "";
    if (!threads.length) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "messages-list__empty";
      emptyItem.textContent = "No conversations yet.";
      list.appendChild(emptyItem);
      return;
    }

    const normalizedTerm = searchTerm.trim().toLowerCase();
    const isSearching = normalizedTerm.length > 0;
    const filteredThreads = threads.filter((thread) => {
      if (!isSearching) return true;
      const nickname = getStoredNickname(thread.username);
      const haystacks = [thread.displayName, thread.fullName, thread.lastMessage?.text, nickname]
        .filter(Boolean)
        .map((value) => value.toLowerCase());
      return haystacks.some((value) => value.includes(normalizedTerm));
    });

    if (!filteredThreads.length) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "messages-list__empty";
      emptyItem.textContent = isSearching
        ? "No conversations match your search."
        : "No conversations yet.";
      list.appendChild(emptyItem);
      return;
    }

    const sorted = filteredThreads
      .slice()
      .sort((a, b) => timestampScore(b.updatedAt) - timestampScore(a.updatedAt));

    const fragment = document.createDocumentFragment();
    sorted.forEach((thread) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.className = "messages-list__item";
      button.dataset.thread = thread.username;

      const inbound = normalizeConnectionState(thread.inbound);
      const outbound = normalizeConnectionState(thread.outbound);
      thread.inbound = inbound;
      thread.outbound = outbound;

      const statusClass = tagClassForStatus(inbound.status ?? "none");
      const statusText = STATUS_LABELS[inbound.status ?? "none"] ?? STATUS_LABELS.none;
      const statusName = STATUS_NAMES[inbound.status ?? "none"] ?? inbound.status ?? "none";
      const nickname = connectionIsAnonymous(inbound) ? "" : getStoredNickname(thread.username);
      const displayTitle = nickname || thread.displayName;
      const aliasMarkup = nickname
        ? `<span class="messages-list__alias">(aka ${escapeHtml(thread.displayName)})</span>`
        : "";
      const timeText = formatRelativeTime(thread.updatedAt) || "";
      const lastMessage = thread.lastMessage ?? null;
      const attachmentCount = Number.isFinite(lastMessage?.attachmentCount)
        ? Math.max(0, lastMessage.attachmentCount)
        : 0;
      const gifCount = Number.isFinite(lastMessage?.gifCount)
        ? Math.max(0, lastMessage.gifCount)
        : 0;
      const mediaCount = attachmentCount + gifCount;
      let previewText;
      if (lastMessage?.text) {
        const safeText = escapeHtml(lastMessage.text);
        previewText = `“${safeText}”`;
      } else if (mediaCount) {
        const mediaParts = [];
        if (attachmentCount) {
          mediaParts.push(
            `${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}`
          );
        }
        if (gifCount) {
          mediaParts.push(`${gifCount} GIF${gifCount === 1 ? "" : "s"}`);
        }
        const label = mediaParts.join(" and ") || "media";
        previewText = `Sent ${escapeHtml(label)}.`;
      } else if (inbound.status && inbound.status !== "none") {
        previewText = `${escapeHtml(thread.displayName)} marked you as ${escapeHtml(
          statusName
        )}.`;
      } else {
        previewText = "No messages yet.";
      }

      const unreadCount = Math.max(0, thread.unreadCount ?? 0);
      const unreadLabel = unreadCount > 99 ? "99+" : String(unreadCount);
      const unreadMarkup = `
        <span class="messages-list__unread" data-unread${
          unreadCount ? "" : " hidden"
        }>${escapeHtml(unreadLabel)}</span>
      `;
      const timeMarkup = timeText
        ? `<span class="messages-list__time">${escapeHtml(timeText)}</span>`
        : "";

      button.innerHTML = `
        <span class="messages-list__row">
          <span class="${statusClass}">${escapeHtml(statusText)}</span>
          ${timeMarkup}
        </span>
        <span class="messages-list__name-row">
          <span class="messages-list__name">${escapeHtml(displayTitle)}</span>
          ${aliasMarkup}
          <span class="user-badges user-badges--compact user-badges--inline" data-user-badges hidden></span>
        </span>
        <span class="messages-list__row messages-list__row--bottom">
          <span class="messages-list__preview">${previewText}</span>
          ${unreadMarkup}
        </span>
      `;
      button.classList.toggle("messages-list__item--unread", unreadCount > 0);
      const badgeContainer = button.querySelector("[data-user-badges]");
      if (connectionIsAnonymous(inbound)) {
        if (badgeContainer) {
          badgeContainer.hidden = true;
          badgeContainer.innerHTML = "";
        }
      } else {
        renderUserBadges(badgeContainer, thread.badges);
      }
      button.addEventListener("click", () => {
        if (!loadingThread) {
          selectThread(thread.username);
        }
      });
      item.appendChild(button);
      fragment.appendChild(item);
    });

    list.appendChild(fragment);
    updateListSelection(activeThread?.username ?? "");
  };

  const markThreadRead = async (thread, force = false) => {
    if (!thread || (!force && thread.unreadCount <= 0)) {
      return;
    }
    try {
      const hadUnread = thread.unreadCount > 0;
      await apiRequest(`/messages/thread/${encodeURIComponent(thread.username)}/read`, {
        method: "POST",
      });
      thread.unreadCount = 0;
      const summary = threads.find((entry) => entry.username === thread.username);
      if (summary) {
        summary.unreadCount = 0;
      }
      threadMap.set(thread.username, thread);
      if (hadUnread) {
        renderList();
      }
    } catch (error) {
      console.warn("Unable to mark conversation read", error);
    }
  };

  const loadOlderMessages = async (thread) => {
    if (
      !thread ||
      !thread.hasMore ||
      !thread.previousCursor ||
      loadingOlderMessages
    ) {
      return;
    }
    loadingOlderMessages = true;
    thread.loadingOlder = true;
    if (loadMoreButton) {
      loadMoreButton.disabled = true;
      loadMoreButton.textContent = "Loading earlier messages...";
    }
    const previousHeight = messageLog.scrollHeight;
    try {
      const older = await fetchThreadDetail(thread.username, {
        cursor: thread.previousCursor,
      });
      const newMessages = Array.isArray(older?.messages) ? older.messages : [];
      if (newMessages.length) {
        const existingIds = new Set((thread.messages ?? []).map((message) => message.id));
        const merged = newMessages.filter((message) => !existingIds.has(message.id));
        thread.messages = [...merged, ...(thread.messages ?? [])];
      }
      thread.hasMore = Boolean(older?.hasMore);
      thread.previousCursor = older?.previousCursor ?? null;
      thread.totalMessages = Number.isFinite(older?.totalMessages)
        ? older.totalMessages
        : thread.totalMessages;
      const summary = threads.find((entry) => entry.username === thread.username);
      if (summary && Number.isFinite(thread.totalMessages)) {
        summary.totalMessages = thread.totalMessages;
      }
    } catch (error) {
      console.error("Unable to load earlier messages", error);
      window.alert(error?.message || "We couldn't load earlier messages.");
    } finally {
      thread.loadingOlder = false;
      loadingOlderMessages = false;
      renderThreadView(context, thread, {
        preserveScroll: true,
        previousScrollHeight: previousHeight,
      });
      attachThreadControls(thread);
    }
  };

  if (loadMoreButton) {
    loadMoreButton.addEventListener("click", () => {
      if (activeThread) {
        loadOlderMessages(activeThread);
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchTerm = searchInput.value || "";
      renderList();
    });
  }

  const updateOutbound = async (thread, anonymous) => {
    const originalOutbound = normalizeConnectionState(thread.outbound);
    const originalInbound = normalizeConnectionState(thread.inbound);
    if (originalOutbound.status !== "want" && originalOutbound.status !== "both") {
      return;
    }

    let aliasValue = originalOutbound.alias;
    if (anonymous) {
      const aliasResult = promptForAlias(aliasValue);
      if (aliasResult === null) {
        renderThreadView(context, thread);
        attachThreadControls(thread);
        return;
      }
      aliasValue = aliasResult;
    } else {
      aliasValue = "";
    }

    const optimisticOutbound = {
      ...originalOutbound,
      anonymous,
      alias: aliasValue,
      updatedAt: new Date().toISOString(),
    };

    try {
      const result = await apiRequest("/status", {
        method: "POST",
        body: JSON.stringify({
          targetUsername: thread.username,
          status: originalOutbound.status,
          anonymous: optimisticOutbound.anonymous,
          alias: optimisticOutbound.alias,
        }),
      });
      const connection = result?.connection;
      if (connection) {
        const updatedOutbound = normalizeConnectionState(
          connection.outbound ?? optimisticOutbound
        );
        const updatedInbound = normalizeConnectionState(
          connection.inbound ?? originalInbound
        );
        thread.outbound = updatedOutbound;
        thread.inbound = updatedInbound;
        thread.updatedAt =
          updatedOutbound.updatedAt ??
          updatedInbound.updatedAt ??
          thread.updatedAt ??
          null;
        threadMap.set(thread.username, thread);
        const summary = threads.find((entry) => entry.username === thread.username);
        if (summary) {
          summary.outbound = updatedOutbound;
          summary.inbound = updatedInbound;
          summary.updatedAt = thread.updatedAt;
        }
        renderThreadView(context, thread);
        attachThreadControls(thread);
        renderList();
      }
    } catch (error) {
      const message =
        error?.status === 401
          ? "Log in to update your anonymity."
          : error?.message || "We couldn't update anonymity right now.";
      window.alert(message);
      thread.outbound = originalOutbound;
      thread.inbound = originalInbound;
      const summary = threads.find((entry) => entry.username === thread.username);
      if (summary) {
        summary.outbound = originalOutbound;
        summary.inbound = originalInbound;
      }
      renderThreadView(context, thread);
      attachThreadControls(thread);
      renderList();
    }
  };

  const attachThreadControls = (thread) => {
    const outbound = normalizeConnectionState(thread.outbound);
    thread.outbound = outbound;
    const canReveal = outbound.status === "want" || outbound.status === "both";
    if (revealToggle) {
      revealToggle.onchange = () => {
        if (!canReveal) return;
        updateOutbound(thread, !revealToggle.checked);
      };
    }
    if (switchAnon) {
      switchAnon.onclick = () => {
        if (!canReveal) return;
        const latest = normalizeConnectionState(thread.outbound);
        updateOutbound(thread, !latest.anonymous);
      };
    }
    if (requestReveal) {
      requestReveal.onclick = () => {
        window.alert("Request to reveal sent. They'll decide when to make it public.");
      };
    }
    composer.onsubmit = async (event) => {
      event.preventDefault();
      const textValue = input?.value.trim() ?? "";
      const hasText = textValue.length > 0;
      const hasAttachments = composerState.attachments.length > 0;
      const hasGifs = composerState.gifs.length > 0;
      if (!hasText && !hasAttachments && !hasGifs) {
        return;
      }
      const usingFormData = hasAttachments;
      let body;
      if (usingFormData) {
        const formData = new FormData();
        if (hasText) {
          formData.append("text", textValue);
        }
        composerState.attachments.forEach((attachment) => {
          if (attachment.file) {
            formData.append("attachments", attachment.file, attachment.file.name);
          }
        });
        composerState.gifs.forEach((gif) => {
          if (gif.url) {
            formData.append("gifUrls", gif.url);
          }
        });
        if (composerState.replyTo?.id) {
          formData.append("replyTo", composerState.replyTo.id);
        }
        body = formData;
      } else {
        const payload = {};
        if (hasText) {
          payload.text = textValue;
        }
        if (hasGifs) {
          payload.gifUrls = composerState.gifs.map((gif) => gif.url);
        }
        if (composerState.replyTo?.id) {
          payload.replyTo = composerState.replyTo.id;
        }
        body = JSON.stringify(payload);
      }

      try {
        const response = await apiRequest(
          `/messages/thread/${encodeURIComponent(thread.username)}`,
          {
            method: "POST",
            body,
          }
        );
        const message = response?.message;
        const normalizedMessage = normalizeMessageEntry(message) ?? message ?? null;
        if (normalizedMessage) {
          thread.messages = Array.isArray(thread.messages) ? thread.messages : [];
          const currentCount = Number.isFinite(thread.totalMessages)
            ? thread.totalMessages
            : thread.messages.length;
          thread.messages.push(normalizedMessage);
          thread.lastMessage = normalizedMessage;
          thread.updatedAt = normalizedMessage.createdAt;
          thread.totalMessages = currentCount + 1;
          thread.unreadCount = 0;
          threadMap.set(thread.username, thread);
          renderThreadView(context, thread);
          attachThreadControls(thread);
          if (input) {
            input.value = "";
            input.focus();
          }
          const summary = threads.find((entry) => entry.username === thread.username);
          if (summary) {
            summary.lastMessage = normalizedMessage;
            summary.updatedAt = normalizedMessage.createdAt;
            summary.outbound = thread.outbound;
            summary.inbound = thread.inbound;
            summary.unreadCount = 0;
            summary.totalMessages = thread.totalMessages;
          }
          renderList();
          resetComposerState();
          hideEmojiPicker();
          closeReactionPicker();
        }
      } catch (error) {
        const message = error?.message || "We couldn't send that message.";
        window.alert(message);
      }
    };
  };

  const selectThread = async (username) => {
    if (loadingThread) return;
    loadingThread = true;
    try {
      let thread = threadMap.get(username);
      if (!thread || !thread.messages) {
        thread = await fetchThreadDetail(username);
        if (!thread) {
          window.alert("We couldn't load that conversation.");
          return;
        }
        thread.messages = thread.messages ?? [];
        thread.updatedAt =
          thread.messages[thread.messages.length - 1]?.createdAt ??
          thread.inbound?.updatedAt ??
          thread.outbound?.updatedAt ??
          thread.updatedAt ??
          null;
        threadMap.set(username, thread);
        const summary = threads.find((entry) => entry.username === thread.username);
        if (summary) {
          summary.inbound = thread.inbound;
          summary.outbound = thread.outbound;
          summary.displayName = thread.displayName;
          summary.badges = thread.badges;
          summary.lastMessage = thread.messages[thread.messages.length - 1] ?? summary.lastMessage ?? null;
          summary.updatedAt =
            thread.messages[thread.messages.length - 1]?.createdAt ??
            thread.updatedAt ??
            summary.updatedAt ??
            null;
          summary.unreadCount = thread.unreadCount ?? summary.unreadCount ?? 0;
          summary.totalMessages =
            Number.isFinite(thread.totalMessages) && thread.totalMessages >= 0
              ? thread.totalMessages
              : thread.messages.length;
        } else {
          threads.push({
            username: thread.username,
            fullName: thread.fullName,
            displayName: thread.displayName,
            badges: thread.badges,
            inbound: thread.inbound,
            outbound: thread.outbound,
            lastMessage: thread.messages[thread.messages.length - 1] ?? null,
            updatedAt:
              thread.messages[thread.messages.length - 1]?.createdAt ??
              thread.inbound?.updatedAt ??
              thread.outbound?.updatedAt ??
              null,
            unreadCount: thread.unreadCount ?? 0,
            totalMessages:
              Number.isFinite(thread.totalMessages) && thread.totalMessages >= 0
                ? thread.totalMessages
                : thread.messages.length,
          });
        }
        renderList();
      }
    activeThread = thread;
    updateListSelection(username);
    resetComposerState();
    hideEmojiPicker();
    closeReactionPicker();
    closeThreadDetails();
    renderThreadView(context, thread);
    attachThreadControls(thread);
      if (thread.unreadCount > 0) {
        thread.unreadCount = 0;
        const summary = threads.find((entry) => entry.username === thread.username);
        if (summary) {
          summary.unreadCount = 0;
        }
        renderList();
      }
      markThreadRead(thread, true);
    } catch (error) {
      const message =
        error?.status === 404
          ? "That conversation is no longer available."
          : error?.message || "We couldn't load that conversation.";
      window.alert(message);
    } finally {
      loadingThread = false;
    }
  };

  try {
    threads = await fetchThreads();
    threads.forEach((thread) => {
      threadMap.set(thread.username, { ...thread, messages: null });
    });
    renderList();

    const stored = await (async () => {
      try {
        const data = await apiRequest("/messages/selection");
        return data?.thread ?? null;
      } catch (error) {
        if (error.status && error.status !== 404) {
          console.warn("Unable to load stored thread", error);
        }
        return null;
      }
    })();

    if (stored?.person) {
      await selectThread(stored.person);
    } else if (stored?.threadId) {
      await selectThread(stored.threadId);
    } else if (threads.length) {
      await selectThread(threads[0].username);
    }
  } catch (error) {
    console.error("Unable to load conversations", error);
    list.innerHTML = `<li class=\"messages-list__empty\">${escapeHtml(
      error?.message || "We couldn't load conversations right now."
    )}</li>`;
  }
}

async function initProfile() {
  const nameEl = document.querySelector("[data-profile-name]");
  const usernameEl = document.querySelector("[data-profile-username]");
  const usernameHistoryButton = document.querySelector("[data-username-history-button]");
  const usernameHistoryDialog = document.querySelector("[data-username-history-dialog]");
  const usernameHistoryList = document.querySelector("[data-username-history-list]");
  const usernameHistoryEmpty = document.querySelector("[data-username-history-empty]");
  const usernameHistoryNote = document.querySelector("[data-username-history-note]");
  const taglineEl = document.querySelector("[data-profile-tagline]");
  const bioEl = document.querySelector("[data-profile-bio]");
  const detailsList = document.querySelector("[data-profile-details]");
  const pronounsContainer = document.querySelector("[data-profile-pronouns-container]");
  const pronounsEl = document.querySelector("[data-profile-pronouns]");
  const locationContainer = document.querySelector("[data-profile-location-container]");
  const locationEl = document.querySelector("[data-profile-location]");
  const ageRangeContainer = document.querySelector("[data-profile-age-range-container]");
  const ageRangeEl = document.querySelector("[data-profile-age-range]");
  const relationshipContainer = document.querySelector("[data-profile-relationship-container]");
  const relationshipEl = document.querySelector("[data-profile-relationship]");
  const relationshipPill = document.querySelector("[data-profile-relationship-pill]");
  const sexualityContainer = document.querySelector("[data-profile-sexuality-container]");
  const sexualityEl = document.querySelector("[data-profile-sexuality]");
  const spotlightCard = document.querySelector("[data-profile-spotlight-card]");
  const spotlightEl = document.querySelector("[data-profile-spotlight]");
  const journeyCard = document.querySelector("[data-profile-journey-card]");
  const journeyEl = document.querySelector("[data-profile-journey]");
  const interestsList = document.querySelector("[data-profile-interests]");
  const activityList = document.querySelector("[data-profile-activity]");
  const activityEmpty = document.querySelector("[data-activity-empty]");
  const activityActiveEl = document.querySelector("[data-activity-active-events]");
  const activityHighlightedEl = document.querySelector("[data-activity-highlighted-events]");
  const activityPostsEl = document.querySelector("[data-activity-total-posts]");
  const activityMediaEl = document.querySelector("[data-activity-total-media]");
  const activityMoodsEl = document.querySelector("[data-activity-moods-used]");
  const activityUpdatedEl = document.querySelector("[data-activity-last-updated]");
  const linksSection = document.querySelector("[data-profile-links-section]");
  const linksList = document.querySelector("[data-profile-links]");
  const profileBadges = document.querySelector("[data-profile-badges]");
  const avatarImg = document.querySelector("[data-profile-avatar]");
  const avatarButton = document.querySelector(".profile-summary__avatar");
  const eventRing = document.querySelector("[data-event-ring]");
  const statKnow = document.getElementById("stat-know");
  const statWant = document.getElementById("stat-want");
  const statBoth = document.getElementById("stat-both");
  const statsContainer = document.querySelector("[data-profile-stats]");
  const actionsContainer = document.querySelector("[data-profile-actions]");
  const anonList = document.getElementById("profile-anon-list");
  const recentList = document.getElementById("profile-recent-list");
  const eventList = document.getElementById("profile-events");
  const eventEmpty = document.querySelector("[data-events-empty]");
  const postList = document.getElementById("profile-posts");
  const postEmpty = document.querySelector("[data-posts-empty]");
  const editButton = document.querySelector('[data-action="edit-profile"]');
  const avatarInput = document.querySelector("[data-avatar-input]");
  const changeAvatarButton = document.querySelector('[data-action="change-avatar"]');
  const verifyButton = document.querySelector('[data-action="toggle-verified"]');
  const addEventButton = document.querySelector('[data-action="add-event"]');
  const addPostButton = document.querySelector('[data-action="add-post"]');
  const eventModal = document.querySelector("[data-events-modal]");
  const eventModalStage = eventModal?.querySelector("[data-events-modal-stage]");
  const eventModalProgress = eventModal?.querySelector("[data-events-modal-progress]");
  const eventModalEmpty = eventModal?.querySelector("[data-events-modal-empty]");
  const eventModalNav = eventModal?.querySelector("[data-events-modal-nav]");
  const profileDialog = document.querySelector("[data-profile-dialog]");
  const eventDialog = document.querySelector("[data-event-dialog]");
  const postDialog = document.querySelector("[data-post-dialog]");
  const postEditDialog = document.querySelector("[data-post-edit-dialog]");
  const eventLimitNote = document.querySelector("[data-event-limit]");
  const postLimitNote = document.querySelector("[data-post-limit]");
  function createPresenceController(element) {
    if (!element) return null;
    const parent = element.parentNode;
    if (!parent) {
      return {
        element,
        show() {
          element.hidden = false;
        },
        hide() {
          element.hidden = true;
        },
      };
    }
    const placeholder = document.createComment("own-only-placeholder");
    parent.insertBefore(placeholder, element.nextSibling);
    return {
      element,
      parent,
      placeholder,
      show() {
        if (!this.placeholder.parentNode) {
          this.parent.insertBefore(this.placeholder, null);
        }
        if (!this.element.isConnected) {
          this.parent.insertBefore(this.element, this.placeholder);
        }
        this.element.hidden = false;
      },
      hide() {
        if (this.element.isConnected) {
          this.element.remove();
        }
      },
    };
  }

  const ownOnlyControllers = Array.from(
    document.querySelectorAll("[data-own-only], [data-own-control]")
  )
    .map((element) => createPresenceController(element))
    .filter(Boolean);
  const usernameChangeNote = profileDialog?.querySelector("[data-username-note]");

  if (!nameEl || !usernameEl || !taglineEl || !bioEl || !avatarImg || !statKnow || !statWant || !statBoth) {
    return;
  }

  const path = window.location.pathname;
  let requestedUser = null;
  let requestedFromQuery = false;
  const profilePathMatch = path.match(/^\/profile\/@([^/]+)\/?$/i);
  if (profilePathMatch) {
    try {
      requestedUser = decodeURIComponent(profilePathMatch[1]).toLowerCase();
    } catch (error) {
      console.warn("Unable to parse profile path", error);
    }
  }
  if (!requestedUser) {
    const params = new URLSearchParams(window.location.search);
    const queryUser = params.get("user");
    if (queryUser) {
      requestedUser = queryUser.toLowerCase();
      requestedFromQuery = true;
    }
  }

  if (requestedFromQuery && requestedUser) {
    const canonicalGuess = buildProfileUrl(requestedUser);
    if (canonicalGuess && window.location.pathname !== canonicalGuess) {
      window.history.replaceState({}, "", canonicalGuess);
    }
  }

  nameEl.textContent = "Loading…";
  taglineEl.textContent = "Tell people what you're about.";
  bioEl.textContent = "Add more about yourself so people can get to know you.";

  let profileData = null;
  let activeEventIndex = 0;
  let eventAutoAdvanceTimer = null;

  const toggleOwnVisibility = (canEdit) => {
    const canVerify = Boolean(profileData?.canVerify);
    ownOnlyControllers.forEach((controller) => {
      if (canEdit) {
        controller.show();
      } else {
        controller.hide();
      }
    });
    if (actionsContainer) {
      actionsContainer.hidden = !(canEdit || canVerify);
    }
    if (verifyButton && verifyButton.isConnected) {
      verifyButton.hidden = !canVerify;
    }
    if (!canEdit && statsContainer) {
      statsContainer.hidden = !profileData?.stats;
    } else if (statsContainer) {
      statsContainer.hidden = false;
    }
  };

  const applyAvatar = (user, events) => {
    const hasCustomAvatar = Boolean(user.profilePicture);
    const source = hasCustomAvatar
      ? user.profilePicture
      : user.username
      ? `https://api.dicebear.com/6.x/initials/svg?seed=${encodeURIComponent(user.username)}`
      : "";
    if (source) {
      avatarImg.src = source;
    } else {
      avatarImg.removeAttribute("src");
    }
    avatarImg.alt = user.fullName ? `${user.fullName}'s avatar` : "Profile avatar";
    if (avatarButton) {
      avatarButton.classList.toggle(
        "profile-summary__avatar--has-events",
        Boolean(events?.length)
      );
    }
    if (eventRing) {
      EVENT_RING_ACCENT_CLASSES.forEach((cls) => eventRing.classList.remove(cls));
      if (events?.length) {
        const primaryAccent = normalizeEventAccent(events[0]?.accent);
        const accentClass = `profile-summary__event-ring--accent-${primaryAccent}`;
        eventRing.classList.add(accentClass);
        const accentColor = EVENT_ACCENT_COLORS[primaryAccent] ?? "";
        if (accentColor) {
          eventRing.style.setProperty("--event-accent", accentColor);
        } else {
          eventRing.style.removeProperty("--event-accent");
        }
        eventRing.hidden = false;
      } else {
        eventRing.hidden = true;
        eventRing.style.removeProperty("--event-accent");
      }
    }
  };

  const renderAnonymous = (data) => {
    if (!anonList) return;
    anonList.innerHTML = "";
    if (!data?.anonymous?.length) {
      const emptyItem = document.createElement("li");
      emptyItem.dataset.emptyAnon = "true";
      emptyItem.textContent = "No anonymous Want Yous yet.";
      anonList.appendChild(emptyItem);
      return;
    }
    data.anonymous.forEach((entry) => {
      const li = document.createElement("li");
      const info = document.createElement("div");
      const name = document.createElement("h3");
      const displayName = entry.alias?.trim() || entry.fullName || entry.username;
      name.textContent = displayName;
      const meta = document.createElement("p");
      meta.className = "profile-list__meta";
      const statusName = STATUS_NAMES[entry.status] ?? entry.status;
      const when = formatRelativeTime(entry.updatedAt);
      meta.textContent = when ? `${statusName} · ${when}` : statusName;
      info.appendChild(name);
      info.appendChild(meta);
      const tag = document.createElement("span");
      tag.className =
        entry.status === "both"
          ? "tag tag--accent"
          : entry.status === "know"
          ? "tag tag--ghost"
          : "tag";
      tag.textContent = STATUS_NAMES[entry.status] ?? entry.status;
      li.appendChild(info);
      li.appendChild(tag);
      anonList.appendChild(li);
    });
  };

  const renderRecent = (data) => {
    if (!recentList) return;
    recentList.innerHTML = "";
    if (!data?.recent?.length) {
      const emptyItem = document.createElement("li");
      emptyItem.dataset.emptyRecent = "true";
      emptyItem.textContent = "No recent updates yet.";
      recentList.appendChild(emptyItem);
      return;
    }
    data.recent.forEach((entry) => {
      const li = document.createElement("li");
      const info = document.createElement("div");
      const name = document.createElement("h3");
      const displayName = entry.alias?.trim() || entry.fullName || entry.username;
      name.textContent = displayName;
      const meta = document.createElement("p");
      meta.className = "profile-list__meta";
      const statusName = STATUS_NAMES[entry.status] ?? entry.status;
      const when = formatRelativeTime(entry.updatedAt);
      const directionText =
        entry.direction === "inbound"
          ? `They marked you as “${statusName}”`
          : `You marked them as “${statusName}”`;
      meta.textContent = when ? `${directionText} · ${when}` : directionText;
      info.appendChild(name);
      info.appendChild(meta);
      const tag = document.createElement("span");
      tag.className =
        entry.status === "both"
          ? "tag tag--accent"
          : entry.status === "know"
          ? "tag tag--ghost"
          : "tag";
      tag.textContent = STATUS_NAMES[entry.status] ?? entry.status;
      li.appendChild(info);
      li.appendChild(meta);
      li.appendChild(tag);
      recentList.appendChild(li);
    });
  };

  const clearEventAutoAdvance = () => {
    if (eventAutoAdvanceTimer) {
      window.clearTimeout(eventAutoAdvanceTimer);
      eventAutoAdvanceTimer = null;
    }
  };

  const scheduleEventAutoAdvance = () => {
    clearEventAutoAdvance();
    const events = profileData?.events ?? [];
    if (events.length <= 1) {
      return;
    }
    if (!eventModal?.classList.contains("events-modal--open")) {
      return;
    }
    eventAutoAdvanceTimer = window.setTimeout(() => {
      showEventAt(activeEventIndex + 1);
    }, EVENT_VIEW_DURATION_MS);
  };

  const updateEventProgress = () => {
    if (!eventModalProgress) return;
    const segments = Array.from(eventModalProgress.children);
    const events = profileData?.events ?? [];
    segments.forEach((segment, index) => {
      const event = events[index] ?? null;
      const accent = normalizeEventAccent(event?.accent);
      const accentColor = EVENT_ACCENT_COLORS[accent] ?? "";
      if (accentColor) {
        segment.style.setProperty("--event-accent", accentColor);
        segment.style.color = accentColor;
      } else {
        segment.style.removeProperty("--event-accent");
        segment.style.removeProperty("color");
      }
      if (event) {
        segment.dataset.accent = accent;
        const caption = event.text?.trim() || "Shared an update";
        segment.setAttribute("aria-label", caption);
        segment.title = caption;
      } else {
        segment.removeAttribute("data-accent");
        segment.removeAttribute("aria-label");
        segment.removeAttribute("title");
      }
      const highlighted = Boolean(event?.highlighted);
      segment.dataset.highlighted = highlighted ? "true" : "false";
      segment.classList.toggle("is-highlighted", highlighted);
      segment.classList.toggle("is-active", index === activeEventIndex);
    });
  };

  const updateEventNavState = () => {
    if (!eventModalNav) return;
    const events = profileData?.events ?? [];
    const prevButton = eventModalNav.querySelector('[data-action="prev-event"]');
    const nextButton = eventModalNav.querySelector('[data-action="next-event"]');
    const disabled = events.length <= 1;
    if (prevButton) {
      prevButton.disabled = disabled;
    }
    if (nextButton) {
      nextButton.disabled = disabled;
    }
    eventModalNav.hidden = !events.length;
  };

  const renderEventStage = () => {
    if (!eventModalStage) return;
    const events = profileData?.events ?? [];
    const event = events[activeEventIndex] ?? null;
    eventModalStage.innerHTML = "";
    if (!event) {
      eventModalStage.removeAttribute("data-accent");
      eventModalStage.removeAttribute("data-highlighted");
      eventModalStage.removeAttribute("aria-label");
      eventModalStage.style.removeProperty("--event-accent");
      return;
    }
    const accent = normalizeEventAccent(event.accent);
    eventModalStage.dataset.accent = accent;
    eventModalStage.dataset.highlighted = event.highlighted ? "true" : "false";
    const color = EVENT_ACCENT_COLORS[accent] ?? "";
    if (color) {
      eventModalStage.style.setProperty("--event-accent", color);
    } else {
      eventModalStage.style.removeProperty("--event-accent");
    }
    const captionText = event.text?.trim() || "Shared an update";
    const labelText = event.highlighted
      ? `${captionText} (highlighted event)`
      : captionText;
    eventModalStage.setAttribute("aria-label", labelText);
    const heading = document.createElement("h3");
    heading.textContent = captionText;
    eventModalStage.appendChild(heading);
    if (event.attachments?.length) {
      const media = document.createElement("div");
      media.className = "events-modal__media";
      media.appendChild(createMediaFragment(event.attachments));
      eventModalStage.appendChild(media);
    }
    const meta = document.createElement("div");
    meta.className = "events-modal__meta";
    const created = document.createElement("time");
    if (event.createdAt) {
      created.dateTime = event.createdAt;
    }
    created.textContent = formatRelativeTime(event.createdAt) || "Just now";
    meta.appendChild(created);
    const countdown = formatTimeRemaining(event.expiresAt);
    if (countdown) {
      const countdownEl = document.createElement("span");
      countdownEl.textContent = countdown;
      meta.appendChild(countdownEl);
    }
    if (event.highlighted) {
      const badge = document.createElement("span");
      badge.className = "badge badge--accent";
      badge.textContent = "Highlighted";
      meta.appendChild(badge);
    }
    const loop = document.createElement("span");
    loop.textContent = `${event.durationHours || 24}h loop`;
    meta.appendChild(loop);
    eventModalStage.appendChild(meta);
  };

  function showEventAt(index) {
    const events = profileData?.events ?? [];
    if (!events.length) {
      activeEventIndex = 0;
      renderEventStage();
      updateEventProgress();
      updateEventNavState();
      return;
    }
    const total = events.length;
    const nextIndex = ((index % total) + total) % total;
    activeEventIndex = nextIndex;
    renderEventStage();
    updateEventProgress();
    updateEventNavState();
    scheduleEventAutoAdvance();
  }

  const renderEvents = () => {
    if (!eventList || !eventEmpty || !eventModalEmpty) return;
    profileData.events = sortEventsForDisplay(profileData?.events ?? []);
    const events = profileData.events;
    eventList.innerHTML = "";
    const hasEvents = Boolean(events.length);
    eventEmpty.hidden = hasEvents;
    eventModalEmpty.hidden = hasEvents;
    if (avatarButton) {
      avatarButton.classList.toggle("profile-summary__avatar--has-events", hasEvents);
    }
    if (!hasEvents) {
      if (eventModalStage) {
        eventModalStage.innerHTML = "";
        eventModalStage.removeAttribute("data-accent");
        eventModalStage.removeAttribute("data-highlighted");
        eventModalStage.removeAttribute("aria-label");
        eventModalStage.style.removeProperty("--event-accent");
      }
      if (eventModalProgress) {
        eventModalProgress.innerHTML = "";
      }
      updateEventNavState();
      clearEventAutoAdvance();
      applyAvatar(profileData.user, profileData.events);
      return;
    }

    events.forEach((event, index) => {
      const item = document.createElement("li");
      item.className = "profile-event";
      item.dataset.accent = normalizeEventAccent(event.accent);
      item.dataset.highlighted = event.highlighted ? "true" : "false";
      item.tabIndex = 0;
      const caption = event.text?.trim() || "Shared an update";
      const labelText = event.highlighted ? `${caption} (highlighted event)` : caption;
      item.setAttribute("aria-label", labelText);
      const header = document.createElement("div");
      header.className = "profile-event__header";
      const title = document.createElement("strong");
      title.textContent = caption;
      const time = document.createElement("p");
      time.className = "profile-event__timestamp";
      time.textContent = formatRelativeTime(event.createdAt) || "Just now";
      header.appendChild(title);
      header.appendChild(time);
      item.appendChild(header);

      if (event.attachments?.length) {
        const media = document.createElement("div");
        media.className = "profile-event__media";
        media.appendChild(createMediaFragment(event.attachments));
        item.appendChild(media);
      }

      const metaRow = document.createElement("div");
      metaRow.className = "profile-event__meta";
      const countdown = document.createElement("p");
      countdown.className = "profile-event__countdown";
      countdown.textContent = formatTimeRemaining(event.expiresAt);
      metaRow.appendChild(countdown);
      if (event.highlighted) {
        const badge = document.createElement("span");
        badge.className = "badge badge--accent";
        badge.textContent = "Highlighted";
        metaRow.appendChild(badge);
      }
      const durationBadge = document.createElement("span");
      durationBadge.className = "badge badge--muted";
      durationBadge.textContent = `${event.durationHours || 24}h`; 
      metaRow.appendChild(durationBadge);
      item.appendChild(metaRow);

      const openEvent = () => {
        openEventsModal(index);
      };
      item.addEventListener("click", openEvent);
      item.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter" || evt.key === " ") {
          evt.preventDefault();
          openEvent();
        }
      });

      if (profileData?.canEdit) {
        const actions = document.createElement("div");
        actions.className = "profile-event__actions";
        const deleteButton = document.createElement("button");
        deleteButton.className = "button button--ghost";
        deleteButton.type = "button";
        deleteButton.textContent = "Remove";
        deleteButton.addEventListener("click", async (eventClick) => {
          eventClick.stopPropagation();
          if (!window.confirm("Remove this event?")) return;
          try {
            await apiRequest(`/events/${encodeURIComponent(event.id)}`, { method: "DELETE" });
            profileData.events = profileData.events.filter((entry) => entry.id !== event.id);
            renderEvents();
          } catch (error) {
            window.alert(error?.message || "We couldn't remove that event.");
          }
        });
        actions.appendChild(deleteButton);
        item.appendChild(actions);
      }

      eventList.appendChild(item);
    });

    if (eventModalProgress) {
      eventModalProgress.innerHTML = "";
      profileData.events.forEach((event) => {
        const segment = document.createElement("span");
        segment.className = "events-modal__progress-segment";
        const accent = normalizeEventAccent(event.accent);
        segment.dataset.accent = accent;
        const accentColor = EVENT_ACCENT_COLORS[accent] ?? "";
        if (accentColor) {
          segment.style.setProperty("--event-accent", accentColor);
          segment.style.color = accentColor;
        }
        const highlighted = Boolean(event.highlighted);
        segment.dataset.highlighted = highlighted ? "true" : "false";
        if (highlighted) {
          segment.classList.add("is-highlighted");
        }
        const caption = event.text?.trim() || "Shared an update";
        segment.setAttribute("aria-label", caption);
        segment.title = caption;
        const bar = document.createElement("span");
        bar.className = "events-modal__progress-bar";
        segment.appendChild(bar);
        eventModalProgress.appendChild(segment);
      });
    }

    if (activeEventIndex >= profileData.events.length) {
      activeEventIndex = 0;
    }
    updateEventProgress();
    updateEventNavState();
    applyAvatar(profileData.user, profileData.events);
    if (eventModal?.classList.contains("events-modal--open")) {
      showEventAt(activeEventIndex);
    } else {
      renderEventStage();
    }
  };

  const integrateEvent = (event) => {
    if (!event) return;
    const current = Array.isArray(profileData?.events) ? profileData.events : [];
    const next = current.filter((entry) => entry.id !== event.id);
    next.push(event);
    profileData.events = sortEventsForDisplay(next);
    renderEvents();
  };

  const integratePost = (post) => {
    if (!post) return;
    const current = Array.isArray(profileData?.posts) ? profileData.posts : [];
    const next = current.filter((entry) => entry.id !== post.id);
    next.push(post);
    profileData.posts = sortPostsForDisplay(next);
    renderPosts();
  };

  const renderPosts = () => {
    if (!postList || !postEmpty) return;
    const posts = profileData?.posts ?? [];
    postList.innerHTML = "";
    const hasPosts = Boolean(posts.length);
    postEmpty.hidden = hasPosts;
    if (!hasPosts) {
      return;
    }
    posts.forEach((post) => {
      const item = document.createElement("li");
      item.className = "profile-post";
      const header = document.createElement("div");
      header.className = "profile-post__header";
      const title = document.createElement("p");
      title.textContent = post.text || "Shared an update";
      header.appendChild(title);
      const time = document.createElement("p");
      time.className = "profile-post__timestamp";
      const createdText = formatRelativeTime(post.createdAt) || "Just now";
      const updatedText =
        post.updatedAt && post.updatedAt !== post.createdAt
          ? formatRelativeTime(post.updatedAt)
          : null;
      time.textContent = updatedText ? `Updated ${updatedText}` : createdText;
      header.appendChild(time);
      item.appendChild(header);

      const badges = document.createElement("div");
      badges.className = "profile-post__badges";
      const visibility = post.visibility || "public";
      const visibilityBadge = document.createElement("span");
      const visibilityClass = POST_VISIBILITY_BADGE[visibility] || "badge--muted";
      visibilityBadge.className = `badge ${visibilityClass} profile-post__visibility`;
      visibilityBadge.textContent = POST_VISIBILITY_LABELS[visibility] || POST_VISIBILITY_LABELS.public;
      badges.appendChild(visibilityBadge);
      const moodLabel = POST_MOOD_LABELS[post.mood] || "";
      if (moodLabel) {
        const moodBadge = document.createElement("span");
        const moodClass = POST_MOOD_BADGE[post.mood] || "badge--accent";
        moodBadge.className = `badge ${moodClass} profile-post__mood`;
        const dot = document.createElement("span");
        dot.className = "badge__dot";
        moodBadge.appendChild(dot);
        moodBadge.appendChild(document.createTextNode(moodLabel));
        badges.appendChild(moodBadge);
      }
      item.appendChild(badges);

      if (post.attachments?.length) {
        const media = document.createElement("div");
        media.className = "profile-post__media";
        media.appendChild(createMediaFragment(post.attachments));
        item.appendChild(media);
      }

      if (profileData?.canEdit) {
        const actions = document.createElement("div");
        actions.className = "profile-post__actions";
        const editButton = document.createElement("button");
        editButton.className = "button button--ghost";
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => {
          openPostEditor(post);
        });
        actions.appendChild(editButton);
        const deleteButton = document.createElement("button");
        deleteButton.className = "button button--ghost";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", async () => {
          if (!window.confirm("Delete this post?")) return;
          try {
            await apiRequest(`/posts/${encodeURIComponent(post.id)}`, { method: "DELETE" });
            profileData.posts = (profileData.posts ?? []).filter((entry) => entry.id !== post.id);
            renderPosts();
          } catch (error) {
            window.alert(error?.message || "We couldn't delete that post.");
          }
        });
        actions.appendChild(deleteButton);
        item.appendChild(actions);
      }

      postList.appendChild(item);
    });
  };

  function openPostEditor(post) {
    if (!profileData?.canEdit || !post) return;
    if (!postEditDialog || !openDialog(postEditDialog)) {
      const nextText = window.prompt("Update your post", post.text ?? "");
      if (nextText === null) return;
      const nextVisibility = window.prompt(
        "Update visibility (public, connections, private)",
        post.visibility || "public"
      );
      if (nextVisibility === null) return;
      const nextMood = window.prompt(
        "Update mood (none, celebration, question, memory, announcement)",
        post.mood || "none"
      );
      (async () => {
        try {
          const response = await apiRequest(`/posts/${encodeURIComponent(post.id)}`, {
            method: "PATCH",
            body: JSON.stringify({
              text: nextText,
              visibility: nextVisibility,
              mood: nextMood,
            }),
          });
          if (response?.post) {
            integratePost(response.post);
          }
        } catch (error) {
          window.alert(error?.message || "We couldn't update that post.");
        }
      })();
      return;
    }
    const form = postEditDialog.querySelector("form");
    if (!form) return;
    form.reset();
    if (form.elements.postId) {
      form.elements.postId.value = post.id;
    }
    if (form.elements.text) {
      form.elements.text.value = post.text ?? "";
    }
    if (form.elements.visibility) {
      form.elements.visibility.value = post.visibility || "public";
    }
    if (form.elements.mood) {
      form.elements.mood.value = post.mood || "none";
    }
  }

  const renderProfile = (data) => {
    if (!data) return;
    profileData = {
      ...data,
      user: {
        ...(data.user ?? {}),
      },
    };
    profileData.events = sortEventsForDisplay(data.events ?? []);
    profileData.posts = sortPostsForDisplay(data.posts ?? []);
    activeEventIndex = 0;
    const user = profileData.user;
    user.badges = Array.isArray(user.badges) ? user.badges : [];
    const viewerUsername = sessionUser?.username ?? null;
    const targetUsername = user.username ?? null;
    const isOfficial = viewerUsername === OWNER_USERNAME;
    if (!isOfficial && verifyButton?.isConnected) {
      verifyButton.remove();
    }
    const canVerify =
      Boolean(data.canVerify) &&
      isOfficial &&
      targetUsername &&
      targetUsername !== viewerUsername;
    profileData.canVerify = canVerify;
    if (profileData.canEdit) {
      sessionUser = { ...sessionUser, ...user };
      updateProfileLinks(user.username);
      const canonicalPath = buildProfileUrl(user.username);
      if (window.location.pathname !== canonicalPath) {
        window.history.replaceState({}, "", canonicalPath);
      }
    }

    nameEl.textContent = user.fullName ?? "Profile";
    usernameEl.textContent = user.username ? `@${user.username}` : "";
    const previousUsernames = Array.isArray(user.previousUsernames)
      ? user.previousUsernames.filter((name) => name && name !== user.username)
      : [];
    if (!profileData.canEdit && user.username && requestedUser) {
      const canonicalViewerPath = buildProfileUrl(user.username);
      if (window.location.pathname !== canonicalViewerPath) {
        window.history.replaceState({}, "", canonicalViewerPath);
      }
    }
    if (usernameHistoryButton) {
      usernameHistoryButton.hidden = previousUsernames.length === 0;
      usernameHistoryButton.disabled = previousUsernames.length === 0;
      if (previousUsernames.length) {
        usernameHistoryButton.setAttribute(
          "aria-label",
          `View previous usernames for ${user.fullName || user.username || "this user"}`
        );
        usernameHistoryButton.title = "View previous usernames";
      }
    }
    if (usernameHistoryList) {
      usernameHistoryList.innerHTML = previousUsernames
        .map((name) => `<li>@${escapeHtml(name)}</li>`)
        .join("");
    }
    if (usernameHistoryEmpty) {
      usernameHistoryEmpty.hidden = previousUsernames.length > 0;
    }
    const nextUsernameChangeAt = getNextUsernameChangeAt(user.usernameChangedAt);
    if (usernameHistoryNote) {
      if (profileData.canEdit) {
        if (nextUsernameChangeAt && Date.now() < nextUsernameChangeAt) {
          const iso = new Date(nextUsernameChangeAt).toISOString();
          usernameHistoryNote.textContent = `You can change your username again on ${formatTimestamp(iso)}.`;
        } else {
          usernameHistoryNote.textContent = "You can change your username once every 30 days.";
        }
      } else {
        usernameHistoryNote.textContent = "Previous usernames they've gone by.";
      }
    }
    const taglineFallback = data.canEdit
      ? "Tell people what you're about."
      : "No tagline yet.";
    taglineEl.textContent = user.tagline ? user.tagline : taglineFallback;
    taglineEl.classList.toggle("profile-summary__tagline--empty", !user.tagline);
    const bioFallback = data.canEdit
      ? "Add more about yourself so people can get to know you."
      : "No bio yet.";
    bioEl.textContent = user.bio ? user.bio : bioFallback;
    bioEl.classList.toggle("profile-summary__tagline--empty", !user.bio);

    const detailVisibility = [];
    const pronouns = typeof user.pronouns === "string" ? user.pronouns.trim() : "";
    if (pronounsContainer && pronounsEl) {
      const hasPronouns = Boolean(pronouns);
      pronounsContainer.hidden = !hasPronouns;
      if (hasPronouns) {
        pronounsEl.textContent = pronouns;
      }
      detailVisibility.push(hasPronouns);
    }
    const location = typeof user.location === "string" ? user.location.trim() : "";
    if (locationContainer && locationEl) {
      const hasLocation = Boolean(location);
      locationContainer.hidden = !hasLocation;
      if (hasLocation) {
        locationEl.textContent = location;
      }
      detailVisibility.push(hasLocation);
    }
    const ageRange = typeof user.ageRange === "string" ? user.ageRange.trim() : "";
    const hasVerifiedBadge = getDisplayBadges(user.badges).includes("Verified");
    if (ageRangeContainer && ageRangeEl) {
      const hasAgeRange = hasVerifiedBadge && Boolean(ageRange);
      ageRangeContainer.hidden = !hasAgeRange;
      if (hasAgeRange) {
        ageRangeEl.textContent = ageRange;
      } else {
        ageRangeEl.textContent = "";
      }
      detailVisibility.push(hasAgeRange);
    }
    const relationshipLabel = typeof user.relationshipStatusLabel === "string"
      ? user.relationshipStatusLabel.trim()
      : typeof user.relationshipStatus === "string"
      ? user.relationshipStatus
      : "";
    if (relationshipContainer && relationshipEl) {
      const hasRelationship = Boolean(relationshipLabel);
      relationshipContainer.hidden = !hasRelationship;
      if (hasRelationship) {
        relationshipEl.textContent = relationshipLabel;
      }
      detailVisibility.push(hasRelationship);
    }
    if (relationshipPill) {
      if (relationshipLabel) {
        relationshipPill.textContent = relationshipLabel;
        relationshipPill.hidden = false;
      } else {
        relationshipPill.hidden = true;
      }
    }
    const sexuality = typeof user.sexuality === "string" ? user.sexuality.trim() : "";
    if (sexualityContainer && sexualityEl) {
      const hasSexuality = Boolean(sexuality);
      sexualityContainer.hidden = !hasSexuality;
      if (hasSexuality) {
        sexualityEl.textContent = sexuality;
      }
      detailVisibility.push(hasSexuality);
    }
    if (detailsList) {
      const hasDetails = detailVisibility.some(Boolean);
      detailsList.hidden = !hasDetails;
    }

    if (spotlightCard && spotlightEl) {
      const spotlight = typeof user.spotlight === "string" ? user.spotlight.trim() : "";
      if (spotlight) {
        spotlightEl.textContent = spotlight;
        spotlightCard.classList.remove("profile-about__card--empty");
      } else {
        spotlightEl.textContent = data.canEdit
          ? "Highlight a win, milestone, or mission."
          : "No spotlight yet.";
        spotlightCard.classList.add("profile-about__card--empty");
      }
    }
    if (journeyCard && journeyEl) {
      const journey = typeof user.journey === "string" ? user.journey.trim() : "";
      if (journey) {
        journeyEl.textContent = journey;
        journeyCard.classList.remove("profile-about__card--empty");
      } else {
        journeyEl.textContent = data.canEdit
          ? "Connect the dots on where you've been and where you're headed."
          : "No journey shared yet.";
        journeyCard.classList.add("profile-about__card--empty");
      }
    }

    if (interestsList) {
      const interests = Array.isArray(user.interests) ? user.interests.filter(Boolean) : [];
      if (interests.length) {
        interestsList.innerHTML = interests
          .map((interest) => `<li>${escapeHtml(interest)}</li>`)
          .join("");
      } else {
        const emptyMessage = data.canEdit
          ? "Add interests to show people what lights you up."
          : "No interests shared yet.";
        interestsList.innerHTML = `<li data-profile-interests-empty>${escapeHtml(emptyMessage)}</li>`;
      }
    }

    const activity = data.activity ?? {};
    const activityTotals = {
      activeEvents: Number.isFinite(activity.activeEvents) ? activity.activeEvents : 0,
      highlightedEvents: Number.isFinite(activity.highlightedEvents)
        ? activity.highlightedEvents
        : 0,
      totalPosts: Number.isFinite(activity.totalPosts) ? activity.totalPosts : 0,
      totalMedia: Number.isFinite(activity.totalMedia) ? activity.totalMedia : 0,
      moodsUsed: Number.isFinite(activity.moodsUsed) ? activity.moodsUsed : 0,
    };
    const hasActivity =
      activityTotals.activeEvents > 0 ||
      activityTotals.highlightedEvents > 0 ||
      activityTotals.totalPosts > 0 ||
      activityTotals.totalMedia > 0 ||
      activityTotals.moodsUsed > 0 ||
      Boolean(activity.lastUpdatedAt);
    if (activityActiveEl) {
      activityActiveEl.textContent = String(activityTotals.activeEvents);
    }
    if (activityHighlightedEl) {
      activityHighlightedEl.textContent = String(activityTotals.highlightedEvents);
    }
    if (activityPostsEl) {
      activityPostsEl.textContent = String(activityTotals.totalPosts);
    }
    if (activityMediaEl) {
      activityMediaEl.textContent = String(activityTotals.totalMedia);
    }
    if (activityMoodsEl) {
      activityMoodsEl.textContent = String(activityTotals.moodsUsed);
    }
    if (activityUpdatedEl) {
      activityUpdatedEl.textContent = activity.lastUpdatedAt
        ? formatTimestamp(activity.lastUpdatedAt)
        : "—";
    }
    if (activityList) {
      activityList.hidden = !hasActivity;
    }
    if (activityEmpty) {
      activityEmpty.hidden = hasActivity;
      if (!hasActivity) {
        activityEmpty.textContent = data.canEdit
          ? "Activity insights will unlock as you share events or posts."
          : "Activity insights will unlock as events and posts go live.";
      }
    }

    if (linksList) {
      const links = Array.isArray(user.links)
        ? user.links.filter((link) => link && typeof link.url === "string" && link.url)
        : [];
      if (links.length) {
        const items = links
          .map((link) => {
            const label = link.label ? String(link.label) : link.url;
            let subtitle = "";
            try {
              const parsed = new URL(link.url);
              subtitle = parsed.hostname.replace(/^www\./i, "");
            } catch (error) {
              subtitle = "";
            }
            const subtitleHtml = subtitle && subtitle !== label ? `<span>${escapeHtml(subtitle)}</span>` : "";
            return `<li class="profile-links__item"><a href="${escapeHtml(
              link.url
            )}" target="_blank" rel="noreferrer noopener">${escapeHtml(label)}</a>${subtitleHtml}</li>`;
          })
          .join("");
        linksList.innerHTML = items;
      } else {
        const emptyMessage = data.canEdit
          ? "Drop resources, calendars, or work you're proud of."
          : "No links shared yet.";
        linksList.innerHTML = `<li data-profile-links-empty>${escapeHtml(emptyMessage)}</li>`;
      }
    }
    if (linksSection) {
      const hasLinks = Array.isArray(user.links)
        ? user.links.some((link) => link && link.url)
        : false;
      linksSection.hidden = !hasLinks && !data.canEdit;
    }

    applyAvatar(user, profileData.events);
    renderUserBadges(profileBadges, user.badges);

    if (verifyButton && verifyButton.isConnected) {
      if (profileData.canVerify) {
        const isVerified = getDisplayBadges(user.badges).includes("Verified");
        verifyButton.hidden = false;
        verifyButton.disabled = false;
        verifyButton.textContent = isVerified ? "Remove verification" : "Verify user";
      } else {
        verifyButton.hidden = true;
        verifyButton.disabled = true;
      }
    } else if (verifyButton) {
      verifyButton.hidden = true;
      verifyButton.disabled = true;
    }

    if (data.stats) {
      statKnow.textContent = String(data.stats.know ?? 0);
      statWant.textContent = String(data.stats.want ?? 0);
      statBoth.textContent = String(data.stats.both ?? 0);
      if (statsContainer) {
        statsContainer.hidden = false;
      }
    } else if (statsContainer) {
      statsContainer.hidden = true;
    }

    toggleOwnVisibility(Boolean(data.canEdit));
    renderAnonymous(data);
    renderRecent(data);
    renderEvents();
    renderPosts();

    if (eventLimitNote && Number.isFinite(data.maxUploadSize)) {
      eventLimitNote.textContent = `Max file size per upload: ${formatFileSize(
        data.maxUploadSize
      )}.`;
    }
    if (postLimitNote && Number.isFinite(data.maxUploadSize)) {
      postLimitNote.textContent = `Max file size per upload: ${formatFileSize(
        data.maxUploadSize
      )}.`;
    }
  };

  usernameHistoryButton?.addEventListener("click", () => {
    const previousUsernames = Array.isArray(profileData?.user?.previousUsernames)
      ? profileData.user.previousUsernames.filter((name) => name && name !== profileData.user.username)
      : [];
    if (!previousUsernames.length) {
      return;
    }
    if (usernameHistoryDialog && typeof usernameHistoryDialog.showModal === "function") {
      usernameHistoryDialog.showModal();
    } else {
      window.alert(`Previous usernames:\n${previousUsernames.map((name) => `@${name}`).join("\n")}`);
    }
  });

  usernameHistoryDialog?.addEventListener("click", (event) => {
    const action = event.target?.dataset?.action;
    if (action === "close-username-history") {
      usernameHistoryDialog.close();
    }
  });

  verifyButton?.addEventListener("click", async () => {
    if (!profileData?.canVerify || !profileData?.user?.username) {
      return;
    }
    const currentBadges = Array.isArray(profileData.user.badges)
      ? profileData.user.badges
      : [];
    const isVerified = getDisplayBadges(currentBadges).includes("Verified");
    let birthdateValue = profileData.user?.birthdate ?? "";
    if (!isVerified) {
      const input = promptForBirthdate(birthdateValue);
      if (input === null) {
        return;
      }
      birthdateValue = input;
    }
    verifyButton.disabled = true;
    try {
      const payload = {
        username: profileData.user.username,
        verified: !isVerified,
      };
      if (!isVerified) {
        payload.birthdate = birthdateValue;
      }
      const response = await apiRequest("/badges/verify", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (response?.user) {
        profileData.user = response.user;
        renderProfile(profileData);
      }
    } catch (error) {
      window.alert(error?.message || "We couldn't update verification right now.");
    } finally {
      verifyButton.disabled = false;
    }
  });

  const buildProfileRequestPath = () => {
    if (requestedUser) {
      return `/profile?user=${encodeURIComponent(requestedUser)}`;
    }
    return "/profile";
  };

  try {
    await requireSession();
    const data = await apiRequest(buildProfileRequestPath());
    renderProfile(data);
  } catch (error) {
    console.error("Unable to load profile", error);
    taglineEl.textContent = error?.message || "We couldn't load this profile right now.";
  }

  const openDialog = (dialog) => {
    if (!dialog) return false;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
      return true;
    }
    return false;
  };

  editButton?.addEventListener("click", () => {
    if (!profileData?.canEdit || !profileData.user) return;
    if (!openDialog(profileDialog)) {
      const nextFullName = window.prompt(
        "Update your full name",
        profileData.user.fullName ?? ""
      );
      if (nextFullName === null) return;
      const nextUsername = window.prompt(
        "Update your username",
        profileData.user.username ?? ""
      );
      if (nextUsername === null) return;
      const nextTagline = window.prompt(
        "Update your tagline",
        profileData.user.tagline ?? ""
      );
      if (nextTagline === null) return;
      const nextBio = window.prompt("Update your bio", profileData.user.bio ?? "");
      if (nextBio === null) return;
      (async () => {
        try {
          const response = await apiRequest("/profile", {
            method: "PUT",
            body: JSON.stringify({
              fullName: nextFullName,
              username: nextUsername,
              tagline: nextTagline,
              bio: nextBio,
            }),
          });
          profileData.user = response?.user ?? profileData.user;
          renderProfile(profileData);
        } catch (error) {
          if (error?.status === 429 && typeof error?.message === "string") {
            const isoMatch = error.message.match(/on (.+)$/);
            const iso = isoMatch ? isoMatch[1] : null;
            const formatted = iso ? formatTimestamp(iso) : null;
            const message = formatted
              ? `You can change your username again on ${formatted}.`
              : error.message;
            window.alert(message);
          } else {
            window.alert(error?.message || "We couldn't update your profile right now.");
          }
        }
      })();
    } else if (profileDialog) {
      const form = profileDialog.querySelector("form");
      if (form) {
        if (form.elements.fullName) {
          form.elements.fullName.value = profileData.user.fullName ?? "";
        }
        const nextChangeAt = getNextUsernameChangeAt(profileData.user.usernameChangedAt);
        const canChangeUsername = !nextChangeAt || Date.now() >= nextChangeAt;
        form.elements.tagline.value = profileData.user.tagline ?? "";
        form.elements.bio.value = profileData.user.bio ?? "";
        if (form.elements.pronouns) {
          form.elements.pronouns.value = profileData.user.pronouns ?? "";
        }
        if (form.elements.location) {
          form.elements.location.value = profileData.user.location ?? "";
        }
        if (form.elements.relationshipStatus) {
          form.elements.relationshipStatus.value =
            profileData.user.relationshipStatus ?? "open";
        }
        if (form.elements.sexuality) {
          form.elements.sexuality.value = profileData.user.sexuality ?? "";
        }
        if (form.elements.interests) {
          form.elements.interests.value = Array.isArray(profileData.user.interests)
            ? profileData.user.interests.join(", ")
            : "";
        }
        if (form.elements.spotlight) {
          form.elements.spotlight.value = profileData.user.spotlight ?? "";
        }
        if (form.elements.journey) {
          form.elements.journey.value = profileData.user.journey ?? "";
        }
        if (form.elements.links) {
          const linksValue = Array.isArray(profileData.user.links)
            ? profileData.user.links
                .filter((link) => link && link.url)
                .map((link) =>
                  link.label && link.label !== link.url
                    ? `${link.label} - ${link.url}`
                    : link.url
                )
                .join("\n")
            : "";
          form.elements.links.value = linksValue;
        }
        if (usernameChangeNote) {
          if (canChangeUsername) {
            usernameChangeNote.textContent = "You can change your username once every 30 days.";
          } else if (nextChangeAt) {
            const iso = new Date(nextChangeAt).toISOString();
            usernameChangeNote.textContent = `You can change your username again on ${formatTimestamp(iso)}.`;
          } else {
            usernameChangeNote.textContent = "";
          }
        }
        if (form.elements.username) {
          form.elements.username.value = profileData.user.username ?? "";
          form.elements.username.disabled = !canChangeUsername;
          if (!canChangeUsername && usernameChangeNote) {
            form.elements.username.title = usernameChangeNote.textContent || "";
          } else {
            form.elements.username.title = "";
          }
        }
      }
    }
  });

  profileDialog?.addEventListener("close", async () => {
    if (!profileData?.canEdit || profileDialog.returnValue !== "save") {
      return;
    }
    const form = profileDialog.querySelector("form");
    if (!form) return;
    const formData = new FormData(form);
    const payload = {};
    if (formData.has("fullName")) {
      payload.fullName = String(formData.get("fullName") ?? "");
    }
    if (formData.has("username")) {
      const rawUsername = formData.get("username");
      if (rawUsername !== null) {
        payload.username = String(rawUsername);
      }
    }
    if (formData.has("tagline")) {
      payload.tagline = String(formData.get("tagline") ?? "");
    }
    if (formData.has("bio")) {
      payload.bio = String(formData.get("bio") ?? "");
    }
    if (formData.has("pronouns")) {
      payload.pronouns = String(formData.get("pronouns") ?? "");
    }
    if (formData.has("location")) {
      payload.location = String(formData.get("location") ?? "");
    }
    if (formData.has("relationshipStatus")) {
      payload.relationshipStatus = String(formData.get("relationshipStatus") ?? "");
    }
    if (formData.has("sexuality")) {
      payload.sexuality = String(formData.get("sexuality") ?? "");
    }
    if (formData.has("interests")) {
      payload.interests = String(formData.get("interests") ?? "");
    }
    if (formData.has("spotlight")) {
      payload.spotlight = String(formData.get("spotlight") ?? "");
    }
    if (formData.has("journey")) {
      payload.journey = String(formData.get("journey") ?? "");
    }
    if (formData.has("links")) {
      payload.links = String(formData.get("links") ?? "");
    }
    try {
      const response = await apiRequest("/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      profileData.user = response?.user ?? profileData.user;
      renderProfile(profileData);
    } catch (error) {
      if (error?.status === 429 && typeof error?.message === "string") {
        const isoMatch = error.message.match(/on (.+)$/);
        const iso = isoMatch ? isoMatch[1] : null;
        const formatted = iso ? formatTimestamp(iso) : null;
        const message = formatted
          ? `You can change your username again on ${formatted}.`
          : error.message;
        window.alert(message);
      } else {
        window.alert(error?.message || "We couldn't update your profile right now.");
      }
    }
  });

  changeAvatarButton?.addEventListener("click", () => {
    if (!profileData?.canEdit || !avatarInput) return;
    avatarInput.click();
  });

  avatarInput?.addEventListener("change", async () => {
    if (!profileData?.canEdit || !avatarInput?.files?.length) return;
    const file = avatarInput.files[0];
    const form = new FormData();
    form.append("avatar", file);
    try {
      const response = await apiRequest("/profile/avatar", {
        method: "POST",
        body: form,
      });
      profileData.user = response?.user ?? profileData.user;
      renderProfile(profileData);
    } catch (error) {
      window.alert(error?.message || "We couldn't update your photo right now.");
    } finally {
      avatarInput.value = "";
    }
  });

  const submitEventForm = async () => {
    if (!profileData?.canEdit || !eventDialog) return;
    const form = eventDialog.querySelector("form");
    if (!form) return;
    const payload = new FormData(form);
    const textValue = (payload.get("text") ?? "").toString().trim();
    const mediaInput = form.querySelector('input[name="media"]');
    const hasFiles = mediaInput?.files?.length > 0;
    if (!textValue && !hasFiles) {
      window.alert("Add text or media before sharing an event.");
      return;
    }
    try {
      const response = await apiRequest("/events", {
        method: "POST",
        body: payload,
      });
      if (response?.event) {
        integrateEvent(response.event);
      }
    } catch (error) {
      window.alert(error?.message || "We couldn't share that event.");
    } finally {
      form.reset();
    }
  };

  const submitPostForm = async () => {
    if (!profileData?.canEdit || !postDialog) return;
    const form = postDialog.querySelector("form");
    if (!form) return;
    const payload = new FormData(form);
    const textValue = (payload.get("text") ?? "").toString().trim();
    const mediaInput = form.querySelector('input[name="media"]');
    const hasFiles = mediaInput?.files?.length > 0;
    if (!textValue && !hasFiles) {
      window.alert("Add text or media before publishing a post.");
      return;
    }
    try {
      const response = await apiRequest("/posts", {
        method: "POST",
        body: payload,
      });
      if (response?.post) {
        integratePost(response.post);
      }
    } catch (error) {
      window.alert(error?.message || "We couldn't publish that post.");
    } finally {
      form.reset();
    }
  };

  eventDialog?.addEventListener("close", () => {
    if (eventDialog.returnValue === "save") {
      submitEventForm();
    }
  });

  postDialog?.addEventListener("close", () => {
    if (postDialog.returnValue === "save") {
      submitPostForm();
    }
  });

  postEditDialog?.addEventListener("close", async () => {
    const form = postEditDialog.querySelector("form");
    if (!form) return;
    const postId = form.elements.postId?.value;
    if (!postId || !profileData?.canEdit || postEditDialog.returnValue !== "save") {
      form.reset();
      return;
    }
    const payload = {
      text: String(form.elements.text?.value ?? ""),
      visibility: String(form.elements.visibility?.value ?? "public"),
      mood: String(form.elements.mood?.value ?? "none"),
    };
    try {
      const response = await apiRequest(`/posts/${encodeURIComponent(postId)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (response?.post) {
        integratePost(response.post);
      }
    } catch (error) {
      window.alert(error?.message || "We couldn't update that post.");
    } finally {
      form.reset();
    }
  });

  addEventButton?.addEventListener("click", () => {
    if (!profileData?.canEdit) return;
    if (!openDialog(eventDialog)) {
      const text = window.prompt("Share an event (24h)");
      if (text === null) return;
      (async () => {
        const payload = new FormData();
        payload.append("text", text);
        try {
          const response = await apiRequest("/events", { method: "POST", body: payload });
          if (response?.event) {
            integrateEvent(response.event);
          }
        } catch (error) {
          window.alert(error?.message || "We couldn't share that event.");
        }
      })();
    }
  });

  addPostButton?.addEventListener("click", () => {
    if (!profileData?.canEdit) return;
    if (!openDialog(postDialog)) {
      const text = window.prompt("Write a post");
      if (text === null) return;
      (async () => {
        const payload = new FormData();
        payload.append("text", text);
        try {
          const response = await apiRequest("/posts", { method: "POST", body: payload });
          if (response?.post) {
            integratePost(response.post);
          }
        } catch (error) {
          window.alert(error?.message || "We couldn't publish that post.");
        }
      })();
    }
  });

  const closeEventsModal = () => {
    if (!eventModal) return;
    eventModal.classList.remove("events-modal--open");
    eventModal.hidden = true;
    clearEventAutoAdvance();
  };

  const openEventsModal = (index = 0) => {
    if (!eventModal) return;
    if (!profileData?.events?.length && !profileData?.canEdit) {
      return;
    }
    activeEventIndex = Math.max(0, Math.min(index, (profileData?.events?.length ?? 1) - 1));
    eventModal.hidden = false;
    eventModal.classList.add("events-modal--open");
    showEventAt(activeEventIndex);
  };

  avatarButton?.addEventListener("click", () => {
    openEventsModal(activeEventIndex);
  });

  eventModal?.addEventListener("click", (event) => {
    const action = event.target?.dataset?.action;
    if (action === "close-events") {
      closeEventsModal();
    } else if (action === "prev-event") {
      showEventAt(activeEventIndex - 1);
    } else if (action === "next-event") {
      showEventAt(activeEventIndex + 1);
    }
  });

  eventModalStage?.addEventListener("click", () => {
    showEventAt(activeEventIndex + 1);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeEventsModal();
    } else if (eventModal?.classList.contains("events-modal--open")) {
      if (event.key === "ArrowRight") {
        showEventAt(activeEventIndex + 1);
      } else if (event.key === "ArrowLeft") {
        showEventAt(activeEventIndex - 1);
      }
    }
  });
}

function initApp() {
  const page = document.body.dataset.page;
  switch (page) {
    case "landing":
      initLanding();
      break;
    case "signup":
      initSignup();
      break;
    case "lookup":
      initLookup();
      break;
    case "messages":
      initMessages();
      break;
    case "profile":
      initProfile();
      break;
    default:
      break;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initializeAiGuestMode();
  populateCurrentYears();
  setupGlobalControls();
  initApp();
});
