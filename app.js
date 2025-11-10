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

function formatCompactNumber(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0";
  }
  if (value < 1000) {
    return String(Math.floor(value));
  }
  return COMPACT_NUMBER_FORMATTER.format(value);
}

const USER_BADGE_DEFINITIONS = Object.freeze({
  WantYou: { label: "WantYou", variant: "wantyou", icon: "★" },
  Verified: { label: "Verified", variant: "verified", icon: "✔" },
});

const USER_BADGE_ORDER = Object.freeze(["WantYou", "Verified"]);

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

const POST_COMMENT_MAX_LENGTH = 350;
const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
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
  updateAdminNav(null);
}

function updateProfileLinks(username) {
  const target = buildProfileUrl(username);
  document.querySelectorAll("[data-nav-profile]").forEach((anchor) => {
    anchor.setAttribute("href", target);
  });
}

function updateAdminNav(user) {
  const isOwner = Boolean(user && user.username === OWNER_USERNAME);
  document.querySelectorAll(".app-nav").forEach((nav) => {
    let link = nav.querySelector("[data-nav-admin]");
    if (isOwner) {
      if (!link) {
        link = document.createElement("a");
        link.dataset.navAdmin = "";
        link.textContent = "Data";
        nav.appendChild(link);
      }
      link.href = withAiRef("/data/");
      link.hidden = false;
      link.removeAttribute("aria-hidden");
    } else if (link) {
      if (link.getAttribute("aria-current") === "page") {
        link.hidden = true;
        link.setAttribute("aria-hidden", "true");
        link.href = "/data/";
      } else {
        link.remove();
      }
    }
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

function normalizeUsername(value = "") {
  return String(value ?? "").trim().toLowerCase();
}

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

function normalizeReadReceipts(readAt) {
  if (!readAt || typeof readAt !== "object") {
    return {};
  }
  const normalized = {};
  Object.entries(readAt).forEach(([username, iso]) => {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      return;
    }
    if (typeof iso === "string" && iso.trim()) {
      normalized[normalizedUsername] = iso;
    }
  });
  return normalized;
}

function applyReadReceiptsToMessages(messages, receipts, threadUsername) {
  if (!Array.isArray(messages)) {
    return [];
  }
  const normalizedThread = normalizeUsername(threadUsername);
  const threadReadIso = normalizedThread ? receipts[normalizedThread] ?? null : null;
  const threadReadScore = timestampScore(threadReadIso);
  return messages.map((message) => {
    const createdAt =
      typeof message?.createdAt === "string" && message.createdAt ? message.createdAt : null;
    const messageReadIso =
      typeof message?.readAt === "string" && message.readAt
        ? message.readAt
        : threadReadIso && createdAt && threadReadScore >= timestampScore(createdAt)
        ? threadReadIso
        : null;
    const readFlag =
      typeof message?.read === "boolean" ? message.read : Boolean(messageReadIso);
    return {
      ...message,
      id: message?.id ?? "",
      sender: message?.sender ?? "",
      text: typeof message?.text === "string" ? message.text : "",
      createdAt,
      read: readFlag,
      readAt: readFlag ? messageReadIso : null,
    };
  });
}

function normalizeThread(thread) {
  if (!thread) return null;
  const unreadCount =
    Number.isFinite(thread.unreadCount) && thread.unreadCount > 0
      ? Math.floor(thread.unreadCount)
      : 0;
  const totalMessages = Number.isFinite(thread.totalMessages) && thread.totalMessages >= 0
    ? Math.floor(thread.totalMessages)
    : Array.isArray(thread.messages)
    ? thread.messages.length
    : 0;
  const previousCursor = typeof thread.previousCursor === "string" ? thread.previousCursor : null;
  const readAt = normalizeReadReceipts(thread.readAt);
  const normalizedThreadUsername = normalizeUsername(thread.username);
  const lastReadAt =
    typeof thread.lastReadAt === "string" && thread.lastReadAt.trim()
      ? thread.lastReadAt
      : normalizedThreadUsername
      ? readAt[normalizedThreadUsername] ?? null
      : null;
  const normalizedSelf = sessionUser?.username ? normalizeUsername(sessionUser.username) : null;
  const viewerReadAt =
    typeof thread.viewerReadAt === "string" && thread.viewerReadAt.trim()
      ? thread.viewerReadAt
      : normalizedSelf
      ? readAt[normalizedSelf] ?? null
      : null;
  const messages = applyReadReceiptsToMessages(
    Array.isArray(thread.messages) ? thread.messages : [],
    readAt,
    thread.username
  );
  return {
    ...thread,
    inbound: normalizeConnectionState(thread.inbound),
    outbound: normalizeConnectionState(thread.outbound),
    unreadCount,
    totalMessages,
    hasMore: Boolean(thread.hasMore),
    previousCursor,
    readAt,
    lastReadAt,
    viewerReadAt,
    messages,
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

function createMediaFragment(attachments = []) {
  const fragment = document.createDocumentFragment();
  attachments.forEach((attachment) => {
    if (!attachment?.url) {
      return;
    }
    if (attachment.type === "video") {
      const video = document.createElement("video");
      video.controls = true;
      video.src = attachment.url;
      video.preload = "metadata";
      fragment.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.src = attachment.url;
      img.alt = attachment.originalName || "";
      img.loading = "lazy";
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
    updateAdminNav(sessionUser);
    return sessionUser;
  } catch (error) {
    if (error.status === 401) {
      sessionUser = null;
      updateProfileLinks(null);
      updateAdminNav(null);
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
  title.textContent = thread.displayName;
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

  const incomingAuthor = inboundAnonymous
    ? inbound.alias?.trim() || "Anonymous"
    : thread.displayName;
  const normalizedThreadUsername = normalizeUsername(thread.username);
  const partnerReadAt =
    thread.lastReadAt ??
    (normalizedThreadUsername && thread.readAt
      ? thread.readAt[normalizedThreadUsername] ?? null
      : null);
  const partnerReadScore = timestampScore(partnerReadAt);

  messageLog.innerHTML = (thread.messages ?? [])
    .map((message) => {
      const outgoing = message.sender === sessionUser?.username;
      const direction = outgoing ? "outgoing" : "incoming";
      const author = outgoing ? "You" : incomingAuthor;
      const timestamp = formatTimestamp(message.createdAt);
      const meta = `${escapeHtml(author)}${
        timestamp ? ` · ${escapeHtml(timestamp)}` : ""
      }`;
      const messageReadIso =
        typeof message.readAt === "string" && message.readAt
          ? message.readAt
          : partnerReadScore && message.createdAt
          ? partnerReadScore >= timestampScore(message.createdAt)
            ? partnerReadAt
            : null
          : null;
      const isRead = outgoing && (message.read === true || Boolean(messageReadIso));
      const readTime = isRead && messageReadIso ? formatTimestamp(messageReadIso) : "";
      const receipt = isRead
        ? `<span class="message__receipt">Read${readTime ? ` · ${escapeHtml(readTime)}` : ""}</span>`
        : "";
      return `
        <li class="message message--${direction}" data-message-id="${escapeHtml(
          message.id ?? ""
        )}">
          <span class="message__meta">${meta}</span>
          <p>${escapeHtml(message.text ?? "")}</p>
          ${receipt}
        </li>
      `;
    })
    .join("");

  if (!messageLog.innerHTML.trim()) {
    messageLog.innerHTML = "<li class=\"message message--empty\"><p>No messages yet. Say hi!</p></li>";
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
  const loadMoreButton = threadSection.querySelector('[data-action="load-more"]');
  const searchInput = document.querySelector('.app-search input[type="search"]');
  if (!statusHeader || !statusLabel || !title || !messageLog || !composer || !placeholder) {
    return;
  }

  newChatButton?.addEventListener("click", (event) => {
    event.preventDefault();
    window.location.href = withAiRef("/lookup/");
  });

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
  };

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
      const haystacks = [thread.displayName, thread.fullName, thread.lastMessage?.text]
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
      const timeText = formatRelativeTime(thread.updatedAt) || "";
      let previewText;
      if (thread.lastMessage?.text) {
        const safeText = escapeHtml(thread.lastMessage.text);
        previewText = `“${safeText}”`;
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
          <span class="messages-list__name">${escapeHtml(thread.displayName)}</span>
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
      const result = await apiRequest(
        `/messages/thread/${encodeURIComponent(thread.username)}/read`,
        {
          method: "POST",
        }
      );
      thread.unreadCount = 0;
      const normalizedThreadUsername = normalizeUsername(thread.username);
      const viewerUsername = sessionUser?.username ? normalizeUsername(sessionUser.username) : null;
      const receipts = normalizeReadReceipts(result?.readAt);
      const hasReceiptUpdates = Object.keys(receipts).length > 0;
      if (hasReceiptUpdates) {
        thread.readAt = { ...(thread.readAt ?? {}), ...receipts };
        if (normalizedThreadUsername && thread.readAt[normalizedThreadUsername]) {
          thread.lastReadAt = thread.readAt[normalizedThreadUsername];
        }
        if (viewerUsername && thread.readAt[viewerUsername]) {
          thread.viewerReadAt = thread.readAt[viewerUsername];
        }
        if (Array.isArray(thread.messages)) {
          thread.messages = applyReadReceiptsToMessages(
            thread.messages,
            thread.readAt,
            thread.username
          );
        }
      }
      const viewerReadAt =
        typeof result?.viewerReadAt === "string" && result.viewerReadAt.trim()
          ? result.viewerReadAt
          : null;
      if (viewerReadAt) {
        thread.viewerReadAt = viewerReadAt;
        if (viewerUsername) {
          thread.readAt = {
            ...(thread.readAt ?? {}),
            [viewerUsername]: viewerReadAt,
          };
        }
      }
      const summary = threads.find((entry) => entry.username === thread.username);
      if (summary) {
        summary.unreadCount = 0;
        if (hasReceiptUpdates) {
          summary.readAt = { ...(summary.readAt ?? {}), ...receipts };
          if (normalizedThreadUsername && summary.readAt[normalizedThreadUsername]) {
            summary.lastReadAt = summary.readAt[normalizedThreadUsername];
          }
          if (viewerUsername && summary.readAt[viewerUsername]) {
            summary.viewerReadAt = summary.readAt[viewerUsername];
          }
        }
        if (viewerReadAt) {
          summary.viewerReadAt = viewerReadAt;
          if (viewerUsername) {
            summary.readAt = {
              ...(summary.readAt ?? {}),
              [viewerUsername]: viewerReadAt,
            };
          }
        }
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
        thread.messages = applyReadReceiptsToMessages(
          thread.messages,
          thread.readAt ?? {},
          thread.username
        );
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
      const text = input?.value.trim();
      if (!text) return;
      try {
        const response = await apiRequest(
          `/messages/thread/${encodeURIComponent(thread.username)}`,
          {
            method: "POST",
            body: JSON.stringify({ text }),
          }
        );
        const message = response?.message;
        if (message) {
          const normalizedSelf = sessionUser?.username ? normalizeUsername(sessionUser.username) : null;
          thread.messages = thread.messages ?? [];
          const currentCount = Number.isFinite(thread.totalMessages)
            ? thread.totalMessages
            : thread.messages.length;
          thread.readAt = thread.readAt ?? {};
          if (normalizedSelf) {
            thread.readAt[normalizedSelf] = message.createdAt ?? new Date().toISOString();
            thread.viewerReadAt = thread.readAt[normalizedSelf];
          }
          thread.messages.push(message);
          thread.messages = applyReadReceiptsToMessages(
            thread.messages,
            thread.readAt,
            thread.username
          );
          thread.lastMessage = message;
          thread.updatedAt = message.createdAt;
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
            summary.lastMessage = message;
            summary.updatedAt = message.createdAt;
            summary.outbound = thread.outbound;
            summary.inbound = thread.inbound;
            summary.unreadCount = 0;
            summary.totalMessages = thread.totalMessages;
            if (normalizedSelf && thread.readAt?.[normalizedSelf]) {
              summary.readAt = {
                ...(summary.readAt ?? {}),
                [normalizedSelf]: thread.readAt[normalizedSelf],
              };
              summary.viewerReadAt = thread.readAt[normalizedSelf];
            }
          }
          renderList();
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
  const postViewer = document.querySelector("[data-post-viewer]");
  const postViewerText = postViewer?.querySelector("[data-post-viewer-text]");
  const postViewerTimestamp = postViewer?.querySelector("[data-post-viewer-timestamp]");
  const postViewerBadges = postViewer?.querySelector("[data-post-viewer-badges]");
  const postViewerMedia = postViewer?.querySelector("[data-post-viewer-media]");
  const postViewerVisibility = postViewer?.querySelector("[data-post-viewer-visibility]");
  const postViewerMood = postViewer?.querySelector("[data-post-viewer-mood]");
  const postViewerMoodLabel = postViewer?.querySelector("[data-post-viewer-mood-label]");
  const postViewerActions = postViewer?.querySelector("[data-post-viewer-actions]");
  const postViewerComments = postViewer?.querySelector("[data-post-viewer-comments]");
  const postViewerCommentCount = postViewer?.querySelector("[data-post-viewer-comment-count]");
  const postViewerCommentsEmpty = postViewer?.querySelector("[data-post-viewer-comments-empty]");
  const postViewerCommentForm = postViewer?.querySelector("[data-post-viewer-comment-form]");
  const postViewerCommentInput = postViewer?.querySelector("[data-post-viewer-comment-input]");
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
  let activePostId = null;
  const postMap = new Map();

  const viewerCanInteractWithPosts = () => !profileData?.canEdit;

  const getPostById = (postId) => {
    if (!postId) {
      return null;
    }
    if (postMap.has(postId)) {
      return postMap.get(postId);
    }
    const posts = Array.isArray(profileData?.posts) ? profileData.posts : [];
    return posts.find((entry) => entry.id === postId) ?? null;
  };

  const getPostInteractionState = (post) => {
    const interactions = post?.interactions ?? {};
    const likes = interactions.likes ?? {};
    const reposts = interactions.reposts ?? {};
    const shares = interactions.shares ?? {};
    const comments = interactions.comments ?? {};
    const entries = Array.isArray(comments.entries) ? comments.entries : [];
    const likeCount = Number.isFinite(likes.count) ? likes.count : 0;
    const repostCount = Number.isFinite(reposts.count) ? reposts.count : 0;
    const shareCount = Number.isFinite(shares.count) ? shares.count : 0;
    const commentCount = Number.isFinite(comments.total) ? comments.total : entries.length;
    return {
      likeCount,
      viewerLiked: Boolean(likes.viewer),
      repostCount,
      viewerReposted: Boolean(reposts.viewer),
      shareCount,
      viewerShared: Boolean(shares.viewer),
      commentCount,
      comments: entries,
    };
  };

  const renderPostInteractions = (container, post, { variant = "list" } = {}) => {
    if (!container) return;
    container.innerHTML = "";
    if (!post?.id) return;

    const state = getPostInteractionState(post);
    const canInteract = viewerCanInteractWithPosts();
    const baseClass = variant === "viewer" ? "post-viewer__control" : "profile-post__control";

    const createButton = ({ action, label, count, pressed, disabled, onClick, ariaLabel }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `${baseClass} ${baseClass}--${action}`;
      button.dataset.postAction = action;
      button.dataset.postId = post.id;
      if (typeof pressed === "boolean") {
        button.setAttribute("aria-pressed", pressed ? "true" : "false");
        if (pressed) {
          button.classList.add("is-active");
        }
      }
      button.disabled = Boolean(disabled);
      const countValue = Number.isFinite(count) ? count : 0;
      const accessibleLabel = ariaLabel || `${label} (${formatCompactNumber(countValue)})`;
      button.setAttribute("aria-label", accessibleLabel);
      const labelSpan = document.createElement("span");
      labelSpan.textContent = label;
      button.appendChild(labelSpan);
      const countSpan = document.createElement("span");
      countSpan.className = "profile-post__control-count";
      countSpan.textContent = formatCompactNumber(countValue);
      button.appendChild(countSpan);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (typeof onClick === "function") {
          onClick(event, button);
        }
      });
      container.appendChild(button);
      return button;
    };

    createButton({
      action: "like",
      label: "Like",
      count: state.likeCount,
      pressed: state.viewerLiked,
      disabled: !canInteract,
      onClick: async (_event, button) => {
        if (!canInteract) {
          openPostViewer(post.id);
          return;
        }
        button.disabled = true;
        try {
          await performPostInteraction(post.id, "like", {
            method: state.viewerLiked ? "DELETE" : "POST",
          });
        } catch (error) {
          window.alert(error?.message || "We couldn't update your like right now.");
        } finally {
          button.disabled = false;
        }
      },
    });

    createButton({
      action: "comment",
      label: "Comment",
      count: state.commentCount,
      ariaLabel: `View comments (${formatCompactNumber(state.commentCount)})`,
      onClick: () => {
        openPostViewer(post.id, { focusComment: canInteract });
      },
    });

    createButton({
      action: "repost",
      label: "Repost",
      count: state.repostCount,
      pressed: state.viewerReposted,
      disabled: !canInteract,
      onClick: async (_event, button) => {
        if (!canInteract) {
          openPostViewer(post.id);
          return;
        }
        button.disabled = true;
        try {
          await performPostInteraction(post.id, "repost", {
            method: state.viewerReposted ? "DELETE" : "POST",
          });
        } catch (error) {
          window.alert(error?.message || "We couldn't update your repost right now.");
        } finally {
          button.disabled = false;
        }
      },
    });

    createButton({
      action: "share",
      label: "Share",
      count: state.shareCount,
      pressed: state.viewerShared,
      disabled: !canInteract || state.viewerShared,
      onClick: async (_event, button) => {
        if (!canInteract) {
          openPostViewer(post.id);
          return;
        }
        if (state.viewerShared) {
          openPostViewer(post.id);
          return;
        }
        button.disabled = true;
        try {
          await performPostInteraction(post.id, "share");
        } catch (error) {
          window.alert(error?.message || "We couldn't share that post right now.");
        } finally {
          button.disabled = false;
        }
      },
    });
  };

  const renderPostViewerFor = (post, { preserveDraft = true } = {}) => {
    if (!postViewer) return;
    if (!post?.id) {
      closePostViewer();
      return;
    }
    const state = getPostInteractionState(post);
    const canInteract = viewerCanInteractWithPosts();
    const draftValue = preserveDraft ? postViewerCommentInput?.value ?? "" : "";

    if (postViewerText) {
      postViewerText.textContent = post.text?.trim() || "Shared an update";
    }

    if (postViewerTimestamp) {
      const updated = post.updatedAt && post.updatedAt !== post.createdAt;
      const reference = updated ? post.updatedAt : post.createdAt;
      const relative = formatRelativeTime(reference);
      const fallback = formatTimestamp(reference);
      postViewerTimestamp.textContent = updated
        ? `Updated ${relative || fallback || "just now"}`
        : relative || fallback || "Just now";
    }

    if (postViewerBadges) {
      postViewerBadges.innerHTML = "";
      postViewerBadges.hidden = true;
    }

    if (postViewerMedia) {
      postViewerMedia.innerHTML = "";
      if (post.attachments?.length) {
        postViewerMedia.hidden = false;
        postViewerMedia.appendChild(createMediaFragment(post.attachments));
      } else {
        postViewerMedia.hidden = true;
      }
    }

    if (postViewerVisibility) {
      const visibility = post.visibility || "public";
      const visibilityClass = POST_VISIBILITY_BADGE[visibility] || "badge--muted";
      postViewerVisibility.className = `badge ${visibilityClass}`;
      postViewerVisibility.textContent =
        POST_VISIBILITY_LABELS[visibility] || POST_VISIBILITY_LABELS.public;
    }

    if (postViewerMood && postViewerMoodLabel) {
      const moodLabel = POST_MOOD_LABELS[post.mood] || "";
      if (moodLabel) {
        const moodClass = POST_MOOD_BADGE[post.mood] || "badge--accent";
        postViewerMood.className = `badge ${moodClass}`;
        postViewerMood.hidden = false;
        postViewerMoodLabel.textContent = moodLabel;
      } else {
        postViewerMood.hidden = true;
        postViewerMoodLabel.textContent = "";
      }
    }

    renderPostInteractions(postViewerActions, post, { variant: "viewer" });

    if (postViewerCommentCount) {
      postViewerCommentCount.textContent = formatCount(state.commentCount, "comment");
    }

    if (postViewerCommentsEmpty) {
      postViewerCommentsEmpty.hidden = state.commentCount > 0;
    }

    if (postViewerComments) {
      postViewerComments.innerHTML = "";
      state.comments.forEach((entry) => {
        const item = document.createElement("li");
        item.className = "post-viewer__comment";
        const header = document.createElement("div");
        header.className = "post-viewer__comment-header";
        const author = document.createElement("span");
        author.className = "post-viewer__comment-author";
        author.textContent = entry.author?.name || entry.author?.username || "Community member";
        header.appendChild(author);
        const details = [];
        if (entry.author?.username) {
          details.push(`@${entry.author.username}`);
        }
        const relative = formatRelativeTime(entry.createdAt);
        const fallback = formatTimestamp(entry.createdAt);
        if (relative || fallback) {
          details.push(relative || fallback);
        }
        if (details.length) {
          const meta = document.createElement("span");
          meta.textContent = details.join(" · ");
          header.appendChild(meta);
        }
        item.appendChild(header);
        const body = document.createElement("p");
        body.className = "post-viewer__comment-body";
        body.textContent = entry.text ?? "";
        item.appendChild(body);
        postViewerComments.appendChild(item);
      });
    }

    if (postViewerCommentForm) {
      postViewerCommentForm.hidden = !canInteract;
      const submitButton = postViewerCommentForm.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = !canInteract;
      }
    }

    if (postViewerCommentInput) {
      postViewerCommentInput.disabled = !canInteract;
      if (canInteract) {
        const trimmedDraft = draftValue.slice(0, POST_COMMENT_MAX_LENGTH);
        postViewerCommentInput.value = trimmedDraft;
      } else {
        postViewerCommentInput.value = "";
      }
    }
  };

  const closePostViewer = () => {
    if (!postViewer) return;
    if (postViewerCommentForm) {
      postViewerCommentForm.reset();
    }
    if (postViewerCommentInput) {
      postViewerCommentInput.disabled = false;
    }
    postViewer.hidden = true;
    activePostId = null;
  };

  const openPostViewer = (postId, { focusComment = false } = {}) => {
    if (!postViewer) return;
    const post = getPostById(postId);
    if (!post) {
      return;
    }
    activePostId = post.id;
    renderPostViewerFor(post, { preserveDraft: !focusComment });
    postViewer.hidden = false;
    if (focusComment && viewerCanInteractWithPosts() && postViewerCommentInput) {
      window.setTimeout(() => {
        postViewerCommentInput.focus();
      }, 0);
    }
  };

  const refreshActivePostViewer = (options = {}) => {
    if (!activePostId) return;
    const activePost = getPostById(activePostId);
    if (!activePost) {
      closePostViewer();
      return;
    }
    renderPostViewerFor(activePost, options);
  };

  const performPostInteraction = async (postId, action, { method = "POST", body = null } = {}) => {
    if (!postId || !profileData?.user?.username) {
      throw new Error("Post unavailable");
    }
    const owner = profileData.user.username;
    const endpoint = `/profile/${encodeURIComponent(owner)}/posts/${encodeURIComponent(postId)}/${action}`;
    const options = { method };
    if (body !== null && body !== undefined) {
      options.body = typeof body === "string" ? body : JSON.stringify(body);
    }
    const response = await apiRequest(endpoint, options);
    if (response?.post) {
      integratePost(response.post);
      return response.post;
    }
    return null;
  };

  postViewerCommentForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!viewerCanInteractWithPosts()) {
      window.alert("You can't comment on your own post.");
      return;
    }
    if (!activePostId) {
      window.alert("Open a post to comment.");
      return;
    }
    if (!postViewerCommentInput) {
      return;
    }
    const value = postViewerCommentInput.value.trim();
    if (!value) {
      window.alert("Add a comment before posting.");
      postViewerCommentInput.focus();
      return;
    }
    if (value.length > POST_COMMENT_MAX_LENGTH) {
      window.alert(`Comments must be ${POST_COMMENT_MAX_LENGTH} characters or fewer.`);
      postViewerCommentInput.focus();
      return;
    }
    const submitButton = postViewerCommentForm.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
    }
    postViewerCommentInput.disabled = true;
    try {
      await performPostInteraction(activePostId, "comments", {
        method: "POST",
        body: { text: value },
      });
      postViewerCommentForm.reset();
    } catch (error) {
      window.alert(error?.message || "We couldn't add your comment right now.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
      postViewerCommentInput.disabled = false;
      postViewerCommentInput.focus();
    }
  });

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
    postMap.clear();
    const hasPosts = posts.length > 0;
    postEmpty.hidden = hasPosts;
    if (!hasPosts) {
      closePostViewer();
      return;
    }
    const viewerName = profileData?.user?.fullName || profileData?.user?.username || "this user";
    posts.forEach((post) => {
      if (!post?.id) return;
      postMap.set(post.id, post);
      const item = document.createElement("li");
      item.className = "profile-post";
      item.dataset.postId = post.id;
      item.tabIndex = 0;
      const summary = post.text?.trim() || "Shared an update";
      item.setAttribute("aria-label", `Open post from ${viewerName}: ${summary.slice(0, 80)}`);

      const header = document.createElement("div");
      header.className = "profile-post__header";
      const title = document.createElement("p");
      title.textContent = summary;
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
      visibilityBadge.textContent =
        POST_VISIBILITY_LABELS[visibility] || POST_VISIBILITY_LABELS.public;
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

      const controls = document.createElement("div");
      controls.className = "profile-post__controls";
      renderPostInteractions(controls, post, { variant: "list" });
      item.appendChild(controls);

      if (profileData?.canEdit) {
        const actions = document.createElement("div");
        actions.className = "profile-post__actions";
        const editButton = document.createElement("button");
        editButton.className = "button button--ghost";
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", (event) => {
          event.stopPropagation();
          openPostEditor(post);
        });
        actions.appendChild(editButton);
        const deleteButton = document.createElement("button");
        deleteButton.className = "button button--ghost";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", async (event) => {
          event.stopPropagation();
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

      item.addEventListener("click", (event) => {
        if (event.target.closest(".profile-post__control") || event.target.closest(".profile-post__actions")) {
          return;
        }
        openPostViewer(post.id);
      });

      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPostViewer(post.id);
        }
      });

      postList.appendChild(item);
    });

    refreshActivePostViewer({ preserveDraft: true });
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

  postViewer?.addEventListener("click", (event) => {
    const action = event.target?.dataset?.action;
    if (action === "close-post-viewer") {
      closePostViewer();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (postViewer && !postViewer.hidden) {
        closePostViewer();
        return;
      }
      closeEventsModal();
    } else if (
      eventModal?.classList.contains("events-modal--open") &&
      (postViewer?.hidden ?? true)
    ) {
      if (event.key === "ArrowRight") {
        showEventAt(activeEventIndex + 1);
      } else if (event.key === "ArrowLeft") {
        showEventAt(activeEventIndex - 1);
      }
    }
  });
}


async function initData() {
  const statusElement = document.querySelector("[data-data-status]");
  const bodyElement = document.querySelector("[data-data-body]");
  const accountListElement = document.querySelector("[data-account-list]");
  const accountSearchInput = document.querySelector("[data-account-search]");
  const workspaceElement = document.querySelector("[data-workspace]");
  const workspaceEmptyElement = document.querySelector("[data-workspace-empty]");
  const workspaceViewportElement = document.querySelector("[data-workspace-viewport]");
  const canvasElement = document.querySelector("[data-data-canvas]");
  const edgesElement = canvasElement?.querySelector("[data-data-edges]");
  const refreshButton = document.querySelector('[data-action="refresh-data"]');

  if (
    !statusElement ||
    !bodyElement ||
    !accountListElement ||
    !workspaceElement ||
    !workspaceEmptyElement ||
    !workspaceViewportElement ||
    !canvasElement ||
    !edgesElement ||
    !accountSearchInput
  ) {
    return;
  }

  const CANVAS_WIDTH = 3200;
  const CANVAS_HEIGHT = 2200;
  const PAN_SLOP = 320;
  const LAYOUT_STORAGE_KEY = "wantyou:data:layout:v1";
  const DEFAULT_NODE_POSITIONS = {
    account: { x: 1400, y: 900 },
    profile: { x: 900, y: 640 },
    connections: { x: 520, y: 1000 },
    events: { x: 1400, y: 1280 },
    posts: { x: 1850, y: 900 },
  };

  edgesElement.setAttribute("viewBox", `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`);
  edgesElement.setAttribute("preserveAspectRatio", "none");
  edgesElement.setAttribute("width", String(CANVAS_WIDTH));
  edgesElement.setAttribute("height", String(CANVAS_HEIGHT));

  const setStatus = (message, variant = "info") => {
    statusElement.textContent = message;
    statusElement.setAttribute("data-status-variant", variant);
  };

  const disableRefresh = () => {
    if (refreshButton) {
      refreshButton.disabled = true;
    }
  };

  const enableRefresh = () => {
    if (refreshButton) {
      refreshButton.disabled = false;
    }
  };

  const formatJson = (value) => {
    try {
      return JSON.stringify(value ?? null, null, 2);
    } catch (error) {
      return JSON.stringify(null, null, 2);
    }
  };

  const cloneValue = (input) => {
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(input);
      } catch (error) {
        // Fall through to JSON cloning
      }
    }
    if (input === undefined) {
      return undefined;
    }
    try {
      return JSON.parse(JSON.stringify(input));
    } catch (error) {
      return input;
    }
  };

  const defaultValueForKey = (key) => {
    if (key === "events" || key === "posts") {
      return [];
    }
    if (key === "connections") {
      return { incoming: {}, outgoing: {} };
    }
    return {};
  };

  const loadLayouts = () => {
    try {
      const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch (error) {
      // Ignore storage errors
    }
    return {};
  };

  const saveLayouts = (layouts) => {
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layouts));
    } catch (error) {
      // Ignore storage errors
    }
  };

  if (isAiGuestMode()) {
    disableRefresh();
    bodyElement.hidden = true;
    workspaceElement.hidden = true;
    setStatus("Data tools are disabled in AI preview mode.", "warning");
    return;
  }

  let ownerUser;
  try {
    ownerUser = await requireSession();
  } catch (error) {
    disableRefresh();
    bodyElement.hidden = true;
    workspaceElement.hidden = true;
    if (error.status === 401) {
      setStatus("Sign in as the WantYou owner to access this workspace.", "error");
    } else {
      setStatus(error?.message || "Unable to verify session.", "error");
    }
    return;
  }

  if (!ownerUser || ownerUser.username !== OWNER_USERNAME) {
    disableRefresh();
    bodyElement.hidden = true;
    workspaceElement.hidden = true;
    setStatus("Owner access required to view or edit account data.", "error");
    return;
  }

  enableRefresh();

  bodyElement.hidden = true;
  workspaceElement.hidden = false;
  workspaceEmptyElement.hidden = false;
  workspaceViewportElement.hidden = true;

  let layouts = loadLayouts();
  let usersState = [];
  let activeUsername = null;
  let currentNodes = new Map();
  let currentEdges = [];
  let currentPan = { x: 0, y: 0 };
  let cleanupWorkspace = null;
  let resizeListenerAttached = false;
  const edgeAnimationSeeds = new Map();
  let accountSearchTerm = "";
  let accountSearchNormalized = "";

  const getUserLayout = (username) => {
    const normalized = String(username || "");
    if (!layouts[normalized]) {
      layouts[normalized] = { nodes: {}, pan: null };
    }
    const entry = layouts[normalized];
    if (typeof entry.nodes !== "object" || entry.nodes === null) {
      entry.nodes = {};
    }
    if (!entry.pan || typeof entry.pan.x !== "number" || typeof entry.pan.y !== "number") {
      entry.pan = null;
    }
    return entry;
  };

  const persistNodePosition = (username, nodeId, position) => {
    const layout = getUserLayout(username);
    layout.nodes[nodeId] = {
      x: Math.round(position.x),
      y: Math.round(position.y),
    };
    saveLayouts(layouts);
  };

  const persistPan = (username, pan) => {
    const layout = getUserLayout(username);
    layout.pan = {
      x: Math.round(pan.x),
      y: Math.round(pan.y),
    };
    saveLayouts(layouts);
  };

  const ensureWithinBounds = (node, position) => {
    const width = node.offsetWidth || 0;
    const height = node.offsetHeight || 0;
    const maxX = Math.max(0, CANVAS_WIDTH - width);
    const maxY = Math.max(0, CANVAS_HEIGHT - height);
    const clampedX = Math.min(Math.max(position.x, 0), maxX);
    const clampedY = Math.min(Math.max(position.y, 0), maxY);
    return { x: clampedX, y: clampedY };
  };

  const applyNodePosition = (node, position) => {
    const safe = ensureWithinBounds(node, position);
    node.dataset.x = String(safe.x);
    node.dataset.y = String(safe.y);
    node.style.transform = `translate3d(${safe.x}px, ${safe.y}px, 0)`;
    return safe;
  };

  const randomBetween = (min, max) => Math.random() * (max - min) + min;

  const applyNodeAnimation = (node) => {
    if (!node) {
      return;
    }
    node.style.setProperty("--node-animate-delay", `${randomBetween(0, 4).toFixed(2)}s`);
    node.style.setProperty("--node-animate-duration", `${randomBetween(9, 15).toFixed(2)}s`);
  };

  const getEdgeKey = (sourceId, targetId) => `${sourceId}__${targetId}`;

  const getEdgeSeed = (sourceId, targetId) => {
    const key = getEdgeKey(sourceId, targetId);
    if (!edgeAnimationSeeds.has(key)) {
      edgeAnimationSeeds.set(key, {
        delay: randomBetween(0, 3.5),
        duration: randomBetween(7, 12),
        offset: Math.floor(randomBetween(0, 120)),
        hue: randomBetween(18, 36),
      });
    }
    return edgeAnimationSeeds.get(key);
  };

  const setAccountSearchTerm = (value) => {
    accountSearchTerm = value ?? "";
    accountSearchNormalized = accountSearchTerm.trim().toLowerCase();
    if (accountSearchInput) {
      accountSearchInput.value = accountSearchTerm;
      accountSearchInput.dataset.hasValue = accountSearchNormalized ? "true" : "false";
    }
  };

  const highlightMatch = (element, text) => {
    if (!element) {
      return;
    }
    const content = typeof text === "string" ? text : String(text ?? "");
    if (!accountSearchNormalized) {
      element.textContent = content;
      return;
    }
    const lower = content.toLowerCase();
    const index = lower.indexOf(accountSearchNormalized);
    if (index === -1) {
      element.textContent = content;
      return;
    }
    const prefix = content.slice(0, index);
    const match = content.slice(index, index + accountSearchNormalized.length);
    const suffix = content.slice(index + accountSearchNormalized.length);
    element.textContent = "";
    if (prefix) {
      element.append(prefix);
    }
    const mark = document.createElement("mark");
    mark.textContent = match;
    element.appendChild(mark);
    if (suffix) {
      element.append(suffix);
    }
  };

  const getFilteredUsers = () => {
    if (!accountSearchNormalized) {
      return usersState;
    }
    return usersState.filter((user) => {
      const username = user?.profile?.username?.toLowerCase?.() ?? "";
      const fullName = user?.profile?.fullName?.toLowerCase?.() ?? "";
      return username.includes(accountSearchNormalized) || fullName.includes(accountSearchNormalized);
    });
  };

  const getNodeCenter = (node) => {
    const x = Number.parseFloat(node.dataset.x || "0");
    const y = Number.parseFloat(node.dataset.y || "0");
    const width = node.offsetWidth || 0;
    const height = node.offsetHeight || 0;
    return { x: x + width / 2, y: y + height / 2 };
  };

  const buildSquigglePath = (x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) {
      return `M ${x1} ${y1}`;
    }
    const segments = Math.max(3, Math.round(distance / 120));
    const amplitude = Math.min(60, Math.max(18, distance / 12));
    const pathParts = [`M ${x1} ${y1}`];
    for (let index = 1; index <= segments; index += 1) {
      const t = index / segments;
      const midT = (index - 0.5) / segments;
      const cx = x1 + dx * midT;
      const cy = y1 + dy * midT;
      const perpX = -dy;
      const perpY = dx;
      const length = Math.hypot(perpX, perpY) || 1;
      const direction = index % 2 === 0 ? -1 : 1;
      const offset = (amplitude * direction) / 2;
      const controlX = cx + (perpX / length) * offset;
      const controlY = cy + (perpY / length) * offset;
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      pathParts.push(`Q ${controlX} ${controlY} ${px} ${py}`);
    }
    return pathParts.join(" ");
  };

  const applyPan = (pan) => {
    const viewportWidth = workspaceViewportElement.clientWidth || 0;
    const viewportHeight = workspaceViewportElement.clientHeight || 0;
    const minX = viewportWidth - CANVAS_WIDTH - PAN_SLOP;
    const maxX = PAN_SLOP;
    const minY = viewportHeight - CANVAS_HEIGHT - PAN_SLOP;
    const maxY = PAN_SLOP;
    const clampedX = Math.min(Math.max(pan.x, minX), maxX);
    const clampedY = Math.min(Math.max(pan.y, minY), maxY);
    currentPan = { x: clampedX, y: clampedY };
    canvasElement.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
  };

  const updateEdges = () => {
    edgesElement.innerHTML = "";
    const fragment = document.createDocumentFragment();
    currentEdges.forEach(([sourceId, targetId]) => {
      const sourceNode = currentNodes.get(sourceId);
      const targetNode = currentNodes.get(targetId);
      if (!sourceNode || !targetNode) {
        return;
      }
      const start = getNodeCenter(sourceNode);
      const end = getNodeCenter(targetNode);
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", buildSquigglePath(start.x, start.y, end.x, end.y));
      const seed = getEdgeSeed(sourceId, targetId);
      path.dataset.edgeKey = getEdgeKey(sourceId, targetId);
      if (seed) {
        path.style.setProperty("--edge-animation-delay", `${seed.delay.toFixed(2)}s`);
        path.style.setProperty("--edge-animation-duration", `${seed.duration.toFixed(2)}s`);
        path.style.setProperty("--edge-dash-offset", `${seed.offset}`);
        path.style.setProperty("--edge-color", `hsla(${Math.round(seed.hue)}, 92%, 60%, 0.75)`);
      }
      fragment.appendChild(path);
    });
    edgesElement.appendChild(fragment);
  };

  const attachNodeDrag = (node, nodeId, username) => {
    const handle = node.querySelector(".data-node__handle");
    if (!handle) {
      return;
    }
    let pointerId = null;
    let origin = { x: 0, y: 0 };
    let start = { x: 0, y: 0 };

    const onPointerDown = (event) => {
      if (event.button !== 0) {
        return;
      }
      pointerId = event.pointerId;
      origin = {
        x: Number.parseFloat(node.dataset.x || "0"),
        y: Number.parseFloat(node.dataset.y || "0"),
      };
      start = { x: event.clientX, y: event.clientY };
      node.dataset.dragging = "true";
      handle.setPointerCapture(pointerId);
      event.preventDefault();
    };

    const onPointerMove = (event) => {
      if (pointerId !== event.pointerId) {
        return;
      }
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const next = ensureWithinBounds(node, { x: origin.x + dx, y: origin.y + dy });
      applyNodePosition(node, next);
      updateEdges();
    };

    const finishDrag = (event) => {
      if (pointerId !== event.pointerId) {
        return;
      }
      handle.releasePointerCapture(pointerId);
      pointerId = null;
      node.dataset.dragging = "false";
      const finalPosition = {
        x: Number.parseFloat(node.dataset.x || "0"),
        y: Number.parseFloat(node.dataset.y || "0"),
      };
      persistNodePosition(username, nodeId, finalPosition);
    };

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", finishDrag);
    handle.addEventListener("pointercancel", finishDrag);
  };

  const setupCanvasPan = (username) => {
    let pointerId = null;
    let start = { x: 0, y: 0 };
    let origin = { x: 0, y: 0 };

    const onPointerDown = (event) => {
      if (event.button !== 0) {
        return;
      }
      if (event.target.closest("[data-node]") || event.target.closest(".data-node")) {
        return;
      }
      pointerId = event.pointerId;
      start = { x: event.clientX, y: event.clientY };
      origin = { ...currentPan };
      canvasElement.dataset.panning = "true";
      canvasElement.setPointerCapture(pointerId);
      event.preventDefault();
    };

    const onPointerMove = (event) => {
      if (pointerId !== event.pointerId) {
        return;
      }
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      applyPan({ x: origin.x + dx, y: origin.y + dy });
    };

    const finishPan = (event) => {
      if (pointerId !== event.pointerId) {
        return;
      }
      canvasElement.releasePointerCapture(pointerId);
      pointerId = null;
      canvasElement.dataset.panning = "false";
      persistPan(username, currentPan);
    };

    canvasElement.addEventListener("pointerdown", onPointerDown);
    canvasElement.addEventListener("pointermove", onPointerMove);
    canvasElement.addEventListener("pointerup", finishPan);
    canvasElement.addEventListener("pointercancel", finishPan);

    return () => {
      canvasElement.removeEventListener("pointerdown", onPointerDown);
      canvasElement.removeEventListener("pointermove", onPointerMove);
      canvasElement.removeEventListener("pointerup", finishPan);
      canvasElement.removeEventListener("pointercancel", finishPan);
    };
  };

  const createAccountNode = (user) => {
    const node = document.createElement("article");
    node.className = "data-node data-node--account";
    node.dataset.nodeId = "account";
    node.setAttribute("data-node", "account");
    node.dataset.state = "idle";
    applyNodeAnimation(node);

    const handle = document.createElement("header");
    handle.className = "data-node__handle";
    const title = document.createElement("h3");
    title.textContent = "Account";
    handle.appendChild(title);
    const subtitle = document.createElement("span");
    subtitle.textContent = `@${user.profile.username}`;
    handle.appendChild(subtitle);
    node.appendChild(handle);

    const content = document.createElement("div");
    content.className = "data-node__content";

    const summary = document.createElement("div");
    summary.className = "data-node__summary";
    const displayName = user.profile.fullName?.trim() || `@${user.profile.username}`;
    let usernameLineElement = null;
    const name = document.createElement("strong");
    name.textContent = displayName;
    summary.appendChild(name);
    highlightMatch(name, displayName);
    if (user.profile.fullName?.trim()) {
      usernameLineElement = document.createElement("span");
      usernameLineElement.textContent = `@${user.profile.username}`;
      summary.appendChild(usernameLineElement);
      highlightMatch(usernameLineElement, `@${user.profile.username}`);
    }
    const tagline = user.profile.tagline?.trim();
    if (tagline) {
      const taglineEl = document.createElement("span");
      taglineEl.textContent = tagline;
      summary.appendChild(taglineEl);
    }
    content.appendChild(summary);

    if (Array.isArray(user.profile.badges) && user.profile.badges.length) {
      const badgeRow = document.createElement("div");
      badgeRow.className = "data-node__badge-row";
      user.profile.badges.forEach((badge) => {
        const badgeEl = document.createElement("span");
        badgeEl.className = "badge badge--muted";
        badgeEl.textContent = badge;
        badgeRow.appendChild(badgeEl);
      });
      content.appendChild(badgeRow);
    }

    const incomingCount = Object.keys(user.connections?.incoming ?? {}).length;
    const outgoingCount = Object.keys(user.connections?.outgoing ?? {}).length;
    const eventsCount = Array.isArray(user.events) ? user.events.length : 0;
    const postsCount = Array.isArray(user.posts) ? user.posts.length : 0;

    const stats = [
      { label: "Incoming links", value: incomingCount },
      { label: "Outgoing links", value: outgoingCount },
      { label: "Events", value: eventsCount },
      { label: "Posts", value: postsCount },
    ];

    stats.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "data-node__stat";
      const label = document.createElement("span");
      label.textContent = entry.label;
      const value = document.createElement("strong");
      value.textContent = String(entry.value);
      row.appendChild(label);
      row.appendChild(value);
      content.appendChild(row);
    });

    const note = document.createElement("p");
    note.className = "data-node__description";
    note.textContent = "Drag surrounding nodes to reshape how each dataset connects.";
    content.appendChild(note);

    const renameForm = document.createElement("form");
    renameForm.className = "data-node__inline-form";
    renameForm.setAttribute("autocomplete", "off");

    const renameLabel = document.createElement("label");
    const renameInputId = `rename-${user.profile.username}`;
    renameLabel.setAttribute("for", renameInputId);
    renameLabel.textContent = "Username handle";
    renameForm.appendChild(renameLabel);

    const renameInput = document.createElement("input");
    renameInput.className = "data-node__input";
    renameInput.type = "text";
    renameInput.autocomplete = "off";
    renameInput.spellcheck = false;
    renameInput.id = renameInputId;
    renameInput.value = user.profile.username;
    renameForm.appendChild(renameInput);

    const renameActions = document.createElement("div");
    renameActions.className = "data-node__inline-actions";

    const renameSubmit = document.createElement("button");
    renameSubmit.type = "submit";
    renameSubmit.className = "button button--small";
    renameSubmit.textContent = "Update username";
    renameActions.appendChild(renameSubmit);

    const renameReset = document.createElement("button");
    renameReset.type = "button";
    renameReset.className = "button button--ghost button--small";
    renameReset.textContent = "Reset";
    renameActions.appendChild(renameReset);

    renameForm.appendChild(renameActions);

    const renameNote = document.createElement("p");
    renameNote.className = "data-node__inline-note";
    renameNote.textContent = "Changes won't touch their previous usernames log.";
    renameForm.appendChild(renameNote);

    content.appendChild(renameForm);

    const setRenamingState = (renaming) => {
      node.dataset.state = renaming ? "renaming" : "idle";
      renameInput.disabled = renaming;
      renameSubmit.disabled = renaming;
      renameReset.disabled = renaming;
    };

    renameReset.addEventListener("click", (event) => {
      event.preventDefault();
      renameInput.value = user.profile.username;
      renameInput.focus();
    });

    renameForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const currentUsername = user.profile.username;
      const nextRaw = renameInput.value.trim();
      if (!nextRaw) {
        setStatus("Provide a username to continue.", "error");
        renameInput.focus();
        return;
      }
      const normalizedCurrent = (currentUsername || "").toLowerCase();
      const normalizedNext = nextRaw.toLowerCase();
      if (normalizedNext === normalizedCurrent) {
        setStatus(`@${currentUsername} is already using that handle.`, "info");
        return;
      }
      setRenamingState(true);
      try {
        const response = await apiRequest(`/admin/users/${encodeURIComponent(currentUsername)}`, {
          method: "PUT",
          body: JSON.stringify({ username: nextRaw }),
        });
        const appliedUsername =
          typeof response?.user?.profile?.username === "string"
            ? response.user.profile.username
            : normalizedNext;
        subtitle.textContent = `@${appliedUsername}`;
        if (!user.profile.fullName?.trim()) {
          name.textContent = `@${appliedUsername}`;
          highlightMatch(name, `@${appliedUsername}`);
        }
        if (usernameLineElement) {
          usernameLineElement.textContent = `@${appliedUsername}`;
          highlightMatch(usernameLineElement, `@${appliedUsername}`);
        }
        setStatus(`Renamed @${currentUsername} to @${appliedUsername}.`, "success");
        activeUsername = appliedUsername;
        setAccountSearchTerm("");
        await loadData({ silent: true });
      } catch (error) {
        setStatus(error?.message || `Unable to rename @${user.profile.username}.`, "error");
        if (renameInput.isConnected) {
          renameInput.focus();
        }
      } finally {
        if (node.isConnected) {
          setRenamingState(false);
        }
      }
    });

    node.appendChild(content);
    return node;
  };

  const createEditableNode = ({
    id,
    username,
    label,
    description,
    key,
    value,
    defaultValue,
  }) => {
    const node = document.createElement("article");
    node.className = "data-node";
    node.dataset.nodeId = id;
    node.setAttribute("data-node", id);
    node.dataset.state = "ready";
    applyNodeAnimation(node);

    const handle = document.createElement("header");
    handle.className = "data-node__handle";
    const title = document.createElement("h3");
    title.textContent = label;
    handle.appendChild(title);
    const subtitle = document.createElement("span");
    subtitle.textContent = `@${username}`;
    handle.appendChild(subtitle);
    node.appendChild(handle);

    const content = document.createElement("div");
    content.className = "data-node__content";

    if (description) {
      const descriptionEl = document.createElement("p");
      descriptionEl.className = "data-node__description";
      descriptionEl.textContent = description;
      content.appendChild(descriptionEl);
    }

    const hint = document.createElement("p");
    hint.className = "data-node__hint";
    hint.textContent = "Adjust nested blocks to update this dataset.";
    content.appendChild(hint);

    const form = document.createElement("form");
    form.className = "data-node__form";

    const blocksContainer = document.createElement("div");
    blocksContainer.className = "data-node__blocks";
    form.appendChild(blocksContainer);

    const actions = document.createElement("div");
    actions.className = "data-node__actions";
    const saveButton = document.createElement("button");
    saveButton.type = "submit";
    saveButton.className = "button";
    saveButton.textContent = "Save changes";
    actions.appendChild(saveButton);
    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "button button--ghost";
    resetButton.textContent = "Reset changes";
    actions.appendChild(resetButton);
    form.appendChild(actions);

    content.appendChild(form);

    const preview = document.createElement("pre");
    preview.className = "data-node__preview";
    content.appendChild(preview);

    node.appendChild(content);

    const nodeDefaultValue = cloneValue(defaultValue);
    const initialValue = value === undefined ? defaultValue : value;
    let originalValue = cloneValue(initialValue === undefined ? null : initialValue);
    let draftValue = cloneValue(initialValue === undefined ? null : initialValue);
    let originalSnapshot = JSON.stringify(originalValue ?? null);
    let fieldIdCounter = 0;

    const getValueType = (input) => {
      if (Array.isArray(input)) {
        return "array";
      }
      if (input === null) {
        return "null";
      }
      if (typeof input === "undefined") {
        return "undefined";
      }
      return typeof input;
    };

    const typeLabels = {
      string: "String",
      number: "Number",
      boolean: "Boolean",
      null: "Null",
      object: "Object",
      array: "Array",
      undefined: "Undefined",
    };

    const getSnapshot = (input) => JSON.stringify(input ?? null);

    const updatePreview = () => {
      preview.textContent = formatJson(draftValue);
    };

    const updateActionButtons = () => {
      const state = node.dataset.state;
      const isSaving = state === "saving";
      const isEditing = state === "editing";
      saveButton.disabled = isSaving || !isEditing;
      resetButton.disabled = isSaving || !isEditing;
    };

    const syncNodeState = () => {
      const draftSnapshot = getSnapshot(draftValue);
      node.dataset.state = draftSnapshot === originalSnapshot ? "ready" : "editing";
      updateActionButtons();
    };

    const getValueAtPath = (path, source = draftValue) =>
      path.reduce((accumulator, keyPart) => {
        if (accumulator === undefined || accumulator === null) {
          return undefined;
        }
        return accumulator[keyPart];
      }, source);

    const getDefaultAtPath = (path) => getValueAtPath(path, nodeDefaultValue);

    const assignValueAtPath = (path, nextValue) => {
      if (!path.length) {
        draftValue = nextValue;
        return;
      }
      let target = draftValue;
      for (let index = 0; index < path.length - 1; index += 1) {
        const keyPart = path[index];
        if (target[keyPart] === undefined) {
          target[keyPart] = typeof path[index + 1] === "number" ? [] : {};
        }
        target = target[keyPart];
      }
      target[path[path.length - 1]] = nextValue;
    };

    const removeValueAtPath = (path) => {
      if (!path.length) {
        draftValue = null;
        return;
      }
      const parentPath = path.slice(0, -1);
      const keyPart = path[path.length - 1];
      const parent = parentPath.length ? getValueAtPath(parentPath) : draftValue;
      if (Array.isArray(parent)) {
        parent.splice(Number(keyPart), 1);
      } else if (parent && typeof parent === "object") {
        delete parent[keyPart];
      }
    };

    const convertValueToType = (current, nextType) => {
      if (nextType === "string") {
        if (typeof current === "string") {
          return current;
        }
        if (current === null || typeof current === "undefined") {
          return "";
        }
        try {
          return JSON.stringify(current);
        } catch (error) {
          return String(current);
        }
      }
      if (nextType === "number") {
        const parsed = Number(current);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      if (nextType === "boolean") {
        if (typeof current === "string") {
          const normalized = current.trim().toLowerCase();
          if (["true", "1", "yes"].includes(normalized)) {
            return true;
          }
          if (["false", "0", "no"].includes(normalized)) {
            return false;
          }
        }
        return Boolean(current);
      }
      if (nextType === "null") {
        return null;
      }
      if (nextType === "object") {
        return {};
      }
      if (nextType === "array") {
        return [];
      }
      return current;
    };

    const refreshStructure = () => {
      renderBlocks();
      updatePreview();
      syncNodeState();
      updateEdges();
    };

    const renderEmptyMessage = (message) => {
      const paragraph = document.createElement("p");
      paragraph.className = "data-block__empty";
      paragraph.textContent = message;
      return paragraph;
    };

    const renderBlock = ({ value: blockValue, path, title: blockTitle, isRoot = false }) => {
      const type = getValueType(blockValue);
      const block = document.createElement("section");
      block.className = "data-block";
      if (isRoot) {
        block.classList.add("data-block--root");
      }

      const header = document.createElement("div");
      header.className = "data-block__header";
      const heading = document.createElement("h4");
      heading.className = "data-block__title";
      heading.textContent = blockTitle;
      header.appendChild(heading);
      const typeBadge = document.createElement("span");
      typeBadge.className = "data-block__type";
      typeBadge.textContent = typeLabels[type] || type;
      header.appendChild(typeBadge);

      if (!isRoot) {
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "button button--ghost button--small data-block__remove";
        removeButton.textContent = "Remove";
        removeButton.addEventListener("click", () => {
          removeValueAtPath(path);
          refreshStructure();
        });
        header.appendChild(removeButton);
      }

      block.appendChild(header);

      const body = document.createElement("div");
      body.className = "data-block__body";

      if (type === "object") {
        const entries = Object.entries(blockValue ?? {});
        if (!entries.length) {
          body.appendChild(renderEmptyMessage("No fields"));
        } else {
          entries.forEach(([childKey, childValue]) => {
            body.appendChild(
              renderBlock({
                value: childValue,
                path: [...path, childKey],
                title: childKey,
              }),
            );
          });
        }
        body.appendChild(createObjectAdder(path, blockValue ?? {}));
      } else if (type === "array") {
        const items = Array.isArray(blockValue) ? blockValue : [];
        if (!items.length) {
          body.appendChild(renderEmptyMessage("No items"));
        } else {
          items.forEach((item, index) => {
            body.appendChild(
              renderBlock({
                value: item,
                path: [...path, index],
                title: `Item ${index + 1}`,
              }),
            );
          });
        }
        body.appendChild(createArrayAdder(path, items));
      } else {
        body.appendChild(
          renderPrimitiveEditor({
            value: blockValue,
            path,
            title: blockTitle,
          }),
        );
      }

      block.appendChild(body);
      return block;
    };

    const renderBlocks = () => {
      blocksContainer.innerHTML = "";
      blocksContainer.appendChild(
        renderBlock({
          value: draftValue,
          path: [],
          title: label,
          isRoot: true,
        }),
      );
    };

    const createArrayAdder = (path, arrayValue) => {
      const formElement = document.createElement("form");
      formElement.className = "data-block__adder";
      formElement.setAttribute("data-array-adder", "true");

      const titleEl = document.createElement("span");
      titleEl.className = "data-block__adder-title";
      titleEl.textContent = "Add item";
      formElement.appendChild(titleEl);

      const valueInput = document.createElement("textarea");
      valueInput.className = "data-block__textarea data-block__adder-input";
      valueInput.placeholder = "Optional JSON value";
      formElement.appendChild(valueInput);

      const controls = document.createElement("div");
      controls.className = "data-block__adder-actions";
      const addButton = document.createElement("button");
      addButton.type = "submit";
      addButton.className = "button button--small";
      addButton.textContent = "Add item";
      controls.appendChild(addButton);
      formElement.appendChild(controls);

      formElement.addEventListener("submit", (event) => {
        event.preventDefault();
        let nextItem;
        const rawValue = valueInput.value.trim();
        if (rawValue) {
          try {
            nextItem = JSON.parse(rawValue);
          } catch (error) {
            setStatus("Unable to parse new array item.", "error");
            valueInput.focus();
            return;
          }
        } else if (arrayValue.length) {
          nextItem = cloneValue(arrayValue[arrayValue.length - 1]);
        } else {
          const defaultArray = getDefaultAtPath(path);
          if (Array.isArray(defaultArray) && defaultArray.length) {
            nextItem = cloneValue(defaultArray[0]);
          } else {
            nextItem = null;
          }
        }
        arrayValue.push(nextItem);
        valueInput.value = "";
        refreshStructure();
      });

      return formElement;
    };

    const createObjectAdder = (path, objectValue) => {
      const formElement = document.createElement("form");
      formElement.className = "data-block__adder";
      formElement.setAttribute("data-object-adder", "true");

      const titleEl = document.createElement("span");
      titleEl.className = "data-block__adder-title";
      titleEl.textContent = "Add field";
      formElement.appendChild(titleEl);

      const nameInput = document.createElement("input");
      nameInput.className = "data-block__input";
      nameInput.type = "text";
      nameInput.placeholder = "Field name";
      nameInput.autocomplete = "off";
      formElement.appendChild(nameInput);

      const valueInput = document.createElement("textarea");
      valueInput.className = "data-block__textarea data-block__adder-input";
      valueInput.placeholder = "Optional JSON value";
      formElement.appendChild(valueInput);

      const controls = document.createElement("div");
      controls.className = "data-block__adder-actions";
      const addButton = document.createElement("button");
      addButton.type = "submit";
      addButton.className = "button button--small";
      addButton.textContent = "Add field";
      controls.appendChild(addButton);
      formElement.appendChild(controls);

      formElement.addEventListener("submit", (event) => {
        event.preventDefault();
        const fieldName = nameInput.value.trim();
        if (!fieldName) {
          setStatus("Provide a field name to continue.", "error");
          nameInput.focus();
          return;
        }
        if (Object.prototype.hasOwnProperty.call(objectValue, fieldName)) {
          setStatus(`Field "${fieldName}" already exists.`, "error");
          nameInput.focus();
          return;
        }
        let initialValue;
        const rawValue = valueInput.value.trim();
        if (rawValue) {
          try {
            initialValue = JSON.parse(rawValue);
          } catch (error) {
            setStatus("Unable to parse field value.", "error");
            valueInput.focus();
            return;
          }
        } else {
          const defaultValueAtPath = getDefaultAtPath([...path, fieldName]);
          initialValue = defaultValueAtPath !== undefined ? cloneValue(defaultValueAtPath) : null;
        }
        objectValue[fieldName] = initialValue;
        nameInput.value = "";
        valueInput.value = "";
        refreshStructure();
      });

      return formElement;
    };

    const renderPrimitiveEditor = ({ value: primitiveValue, path, title: primitiveTitle }) => {
      const wrapper = document.createElement("div");
      wrapper.className = "data-block__field";

      const controlId = `data-block-${id}-${fieldIdCounter += 1}`;

      const header = document.createElement("div");
      header.className = "data-block__field-header";

      const labelEl = document.createElement("label");
      labelEl.className = "data-block__field-label";
      labelEl.setAttribute("for", controlId);
      labelEl.textContent = primitiveTitle;
      header.appendChild(labelEl);

      const typeWrapper = document.createElement("label");
      typeWrapper.className = "data-block__type-label";
      typeWrapper.textContent = "Type";
      const typeSelect = document.createElement("select");
      typeSelect.className = "data-block__select data-block__select--type";
      ["string", "number", "boolean", "null", "object", "array"].forEach((optionType) => {
        const option = document.createElement("option");
        option.value = optionType;
        option.textContent = typeLabels[optionType];
        typeSelect.appendChild(option);
      });
      typeWrapper.appendChild(typeSelect);
      header.appendChild(typeWrapper);

      wrapper.appendChild(header);

      const controlContainer = document.createElement("div");
      controlContainer.className = "data-block__field-control";
      wrapper.appendChild(controlContainer);

      const renderControl = () => {
        const currentValue = getValueAtPath(path);
        const currentType = getValueType(currentValue);
        typeSelect.value = currentType === "undefined" ? "null" : currentType;
        controlContainer.innerHTML = "";

        if (currentType === "string") {
          const textarea = document.createElement("textarea");
          textarea.className = "data-block__textarea";
          textarea.id = controlId;
          textarea.value = typeof currentValue === "string" ? currentValue : "";
          textarea.addEventListener("input", () => {
            assignValueAtPath(path, textarea.value);
            updatePreview();
            syncNodeState();
          });
          controlContainer.appendChild(textarea);
          labelEl.setAttribute("for", controlId);
          return;
        }

        if (currentType === "number") {
          const input = document.createElement("input");
          input.className = "data-block__input";
          input.id = controlId;
          input.type = "number";
          input.value = Number.isFinite(currentValue) ? String(currentValue) : "";
          input.addEventListener("change", () => {
            const parsed = Number(input.value);
            if (!Number.isFinite(parsed)) {
              setStatus("Enter a valid number.", "error");
              input.focus();
              return;
            }
            assignValueAtPath(path, parsed);
            updatePreview();
            syncNodeState();
          });
          controlContainer.appendChild(input);
          labelEl.setAttribute("for", controlId);
          return;
        }

        if (currentType === "boolean") {
          const select = document.createElement("select");
          select.className = "data-block__select";
          select.id = controlId;
          [
            { value: "true", label: "True" },
            { value: "false", label: "False" },
          ].forEach((entry) => {
            const option = document.createElement("option");
            option.value = entry.value;
            option.textContent = entry.label;
            select.appendChild(option);
          });
          select.value = currentValue ? "true" : "false";
          select.addEventListener("change", () => {
            assignValueAtPath(path, select.value === "true");
            updatePreview();
            syncNodeState();
          });
          controlContainer.appendChild(select);
          labelEl.setAttribute("for", controlId);
          return;
        }

        if (currentType === "null" || currentType === "undefined") {
          const note = document.createElement("p");
          note.className = "data-block__null";
          note.textContent = "Value is null.";
          controlContainer.appendChild(note);
          labelEl.removeAttribute("for");
          return;
        }

        const note = document.createElement("p");
        note.className = "data-block__null";
        note.textContent = "Use type controls to edit this value.";
        controlContainer.appendChild(note);
        labelEl.removeAttribute("for");
      };

      renderControl();

      typeSelect.addEventListener("change", () => {
        const latestValue = getValueAtPath(path);
        const nextValue = convertValueToType(latestValue, typeSelect.value);
        assignValueAtPath(path, nextValue);
        refreshStructure();
      });

      return wrapper;
    };

    refreshStructure();

    resetButton.addEventListener("click", () => {
      draftValue = cloneValue(originalValue);
      refreshStructure();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (node.dataset.state !== "editing") {
        setStatus(`No changes to save for ${label.toLowerCase()}.`, "info");
        return;
      }
      node.dataset.state = "saving";
      updateActionButtons();
      try {
        const body = {};
        body[key] = draftValue;
        await apiRequest(`/admin/users/${encodeURIComponent(username)}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        setStatus(`Saved ${label.toLowerCase()} for @${username}.`, "success");
        await loadData({ silent: true });
        if (node.isConnected) {
          originalValue = cloneValue(draftValue);
          originalSnapshot = getSnapshot(originalValue);
          node.dataset.state = "ready";
          updateActionButtons();
          updatePreview();
          updateEdges();
        }
      } catch (error) {
        setStatus(error?.message || `Unable to save ${label.toLowerCase()}.`, "error");
        if (node.isConnected) {
          node.dataset.state = "editing";
          updateActionButtons();
        }
      }
    });

    return node;
  };

  const renderAccountList = () => {
    const users = getFilteredUsers();
    accountListElement.innerHTML = "";
    accountListElement.dataset.empty = users.length ? "false" : "true";
    accountListElement.dataset.searching = accountSearchNormalized ? "true" : "false";
    if (!users.length) {
      return;
    }
    const fragment = document.createDocumentFragment();
    users.forEach((user, index) => {
      const listItem = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.username = user.profile.username;
      button.style.setProperty("--account-animate-delay", `${(index * 0.05).toFixed(2)}s`);
      const meta = document.createElement("div");
      meta.className = "data-account-meta";
      const name = document.createElement("strong");
      highlightMatch(name, user.profile.fullName?.trim() || `@${user.profile.username}`);
      meta.appendChild(name);
      const handle = document.createElement("span");
      handle.className = "data-account-meta__handle";
      highlightMatch(handle, `@${user.profile.username}`);
      meta.appendChild(handle);
      const detail = document.createElement("span");
      const incomingCount = Object.keys(user.connections?.incoming ?? {}).length;
      const outgoingCount = Object.keys(user.connections?.outgoing ?? {}).length;
      const eventsCount = Array.isArray(user.events) ? user.events.length : 0;
      const postsCount = Array.isArray(user.posts) ? user.posts.length : 0;
      detail.textContent = `${incomingCount + outgoingCount} links · ${eventsCount} events · ${postsCount} posts`;
      meta.appendChild(detail);
      button.appendChild(meta);
      listItem.appendChild(button);
      fragment.appendChild(listItem);
    });
    accountListElement.appendChild(fragment);
    updateAccountSelection(activeUsername);
  };

  const updateAccountSelection = (username) => {
    accountListElement.querySelectorAll("button[data-username]").forEach((button) => {
      button.dataset.active = button.dataset.username === username ? "true" : "false";
    });
  };

  const centerOnNode = (node) => {
    const viewportWidth = workspaceViewportElement.clientWidth || 0;
    const viewportHeight = workspaceViewportElement.clientHeight || 0;
    const center = getNodeCenter(node);
    return {
      x: viewportWidth / 2 - center.x,
      y: viewportHeight / 2 - center.y,
    };
  };

  const updateWorkspace = (user) => {
    if (!user) {
      workspaceEmptyElement.hidden = false;
      workspaceViewportElement.hidden = true;
      currentNodes = new Map();
      currentEdges = [];
      edgesElement.innerHTML = "";
      return;
    }

    workspaceEmptyElement.hidden = true;
    workspaceViewportElement.hidden = false;

    if (cleanupWorkspace) {
      cleanupWorkspace();
      cleanupWorkspace = null;
    }

    edgeAnimationSeeds.clear();
    canvasElement.querySelectorAll(".data-node").forEach((node) => node.remove());
    currentNodes = new Map();
    currentEdges = [];

    const username = user.profile.username;
    const layout = getUserLayout(username);

    const accountNode = createAccountNode(user);
    canvasElement.appendChild(accountNode);
    const accountPosition = layout.nodes.account || DEFAULT_NODE_POSITIONS.account;
    applyNodePosition(accountNode, accountPosition);
    currentNodes.set("account", accountNode);

    const editableDefinitions = [
      {
        id: "profile",
        label: "Profile",
        description: "Edit core identity details, visibility, and metadata.",
        key: "profile",
        value: user.profile ?? {},
        defaultValue: defaultValueForKey("profile"),
      },
      {
        id: "connections",
        label: "Connections",
        description: "Update incoming and outgoing connection graphs.",
        key: "connections",
        value: user.connections ?? {},
        defaultValue: defaultValueForKey("connections"),
      },
      {
        id: "events",
        label: "Events",
        description: "Manage spotlight events shown on profiles.",
        key: "events",
        value: user.events ?? [],
        defaultValue: defaultValueForKey("events"),
      },
      {
        id: "posts",
        label: "Posts",
        description: "Review and edit posts, moods, and attachments.",
        key: "posts",
        value: user.posts ?? [],
        defaultValue: defaultValueForKey("posts"),
      },
    ];

    editableDefinitions.forEach((definition) => {
      const node = createEditableNode({
        ...definition,
        username,
      });
      canvasElement.appendChild(node);
      const savedPosition = layout.nodes[definition.id] || DEFAULT_NODE_POSITIONS[definition.id] || {
        x: 0,
        y: 0,
      };
      applyNodePosition(node, savedPosition);
      attachNodeDrag(node, definition.id, username);
      currentNodes.set(definition.id, node);
      currentEdges.push(["account", definition.id]);
    });

    attachNodeDrag(accountNode, "account", username);

    let startingPan = layout.pan;
    if (!startingPan) {
      startingPan = centerOnNode(accountNode);
      persistPan(username, startingPan);
    }
    applyPan(startingPan);

    cleanupWorkspace = setupCanvasPan(username);
    updateEdges();
    if (!resizeListenerAttached) {
      window.addEventListener("resize", updateEdges);
      resizeListenerAttached = true;
    }
  };

  const selectAccount = (username, { announce = false } = {}) => {
    if (!username) {
      workspaceEmptyElement.hidden = false;
      workspaceViewportElement.hidden = true;
      activeUsername = null;
      updateAccountSelection("");
      return;
    }
    const user = usersState.find((entry) => entry?.profile?.username === username);
    if (!user) {
      setStatus(`Account @${username} is no longer available.`, "error");
      return;
    }
    activeUsername = username;
    updateAccountSelection(username);
    updateWorkspace(user);
    if (announce) {
      const display = user.profile.fullName?.trim() || `@${username}`;
      setStatus(`Viewing data graph for ${display}.`, "info");
    }
  };

  let loading = false;

  const loadData = async ({ silent = false } = {}) => {
    if (loading) {
      return;
    }
    loading = true;
    if (!silent) {
      setStatus("Loading account data…", "info");
      bodyElement.hidden = true;
      workspaceEmptyElement.hidden = false;
      workspaceViewportElement.hidden = true;
    }
    disableRefresh();
    try {
      const payload = await apiRequest("/admin/data");
      usersState = Array.isArray(payload?.users) ? payload.users : [];
      renderAccountList();
      bodyElement.hidden = false;
      if (!usersState.length) {
        workspaceEmptyElement.hidden = false;
        workspaceEmptyElement.textContent = "No accounts found.";
        workspaceViewportElement.hidden = true;
      } else {
        const preserved = activeUsername && usersState.some((user) => user.profile.username === activeUsername);
        const targetUsername = preserved ? activeUsername : usersState[0].profile.username;
        selectAccount(targetUsername, { announce: !silent && !preserved });
      }
      if (!silent) {
        const count = usersState.length;
        setStatus(`Loaded ${count} ${count === 1 ? "account" : "accounts"}.`, "success");
      }
    } catch (error) {
      setStatus(error?.message || "Unable to load account data.", "error");
      usersState = [];
      renderAccountList();
      bodyElement.hidden = true;
      workspaceViewportElement.hidden = true;
      workspaceEmptyElement.hidden = false;
    } finally {
      loading = false;
      enableRefresh();
    }
  };

  setAccountSearchTerm(accountSearchInput.value ?? "");

  accountSearchInput.addEventListener("input", (event) => {
    setAccountSearchTerm(event.target.value ?? "");
    renderAccountList();
  });

  accountSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && accountSearchNormalized) {
      event.preventDefault();
      setAccountSearchTerm("");
      renderAccountList();
    }
  });

  accountListElement.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-username]");
    if (!button) {
      return;
    }
    selectAccount(button.dataset.username, { announce: true });
  });

  refreshButton?.addEventListener("click", (event) => {
    event.preventDefault();
    loadData().catch(() => {});
  });

  try {
    await loadData();
  } catch (error) {
    // Status already handled in loadData
  }
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
    case "data":
      initData();
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
