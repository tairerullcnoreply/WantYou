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

const STATUS_NAMES = {
  none: "None",
  know: "Know you",
  want: "Want you",
  both: "Both",
};

const USER_BADGE_DEFINITIONS = Object.freeze({
  WantYou: { label: "WantYou", variant: "wantyou", icon: "★" },
  Verified: { label: "Verified", variant: "verified", icon: "✔" },
});

const USER_BADGE_ORDER = Object.freeze(["WantYou", "Verified"]);

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

function buildApiUrl(path) {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
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

async function apiRequest(path, options = {}) {
  const url = buildApiUrl(path);
  const init = { ...options };
  const headers = new Headers(init.headers || {});
  const token = getSessionToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
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

function normalizeThread(thread) {
  if (!thread) return null;
  return {
    ...thread,
    inbound: normalizeConnectionState(thread.inbound),
    outbound: normalizeConnectionState(thread.outbound),
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
      fragment.appendChild(img);
    }
  });
  return fragment;
}

async function loadSession() {
  try {
    const data = await apiRequest("/session");
    sessionUser = data?.user ?? null;
    return sessionUser;
  } catch (error) {
    if (error.status === 401) {
      sessionUser = null;
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
      window.location.href = "signup.html";
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

function initLanding() {
  const heroCard = document.getElementById("hero-card");
  const year = document.getElementById("year");
  const form = document.getElementById("request-access");
  let heroIndex = 0;

  if (year) {
    year.textContent = new Date().getFullYear();
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
  const year = document.getElementById("signup-year");

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      if (!target) return;

      tabs.forEach((button) => button.classList.toggle("signup__tab--active", button === tab));

      [signupForm, loginForm].forEach((form) => {
        if (!form) return;
        const isTarget = form.dataset.form === target;
        form.classList.toggle("signup__form--hidden", !isTarget);
      });
    });
  });

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
      window.location.href = "feed.html";
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
  updateBadge(card, displayInbound.status, displayInbound.anonymous);
  updateChips(card, normalizedOutbound.status);
  updateAnonToggle(card, normalizedOutbound.status, normalizedOutbound.anonymous);
  setOutboundNote(card, normalizedOutbound);
}

function applyLookupFilters({ cards, input, filterAnon, emptyState, emptyTextWhenNoCards }) {
  const query = input?.value.trim().toLowerCase() ?? "";
  const anonOnly = Boolean(filterAnon?.checked);
  let anyVisible = false;

  cards.forEach((card) => {
    const name = card.dataset.name?.toLowerCase() ?? "";
    const username = card.dataset.username?.toLowerCase() ?? "";
    const inboundStatus = card.dataset.inboundStatus ?? "none";
    const inboundAnonymous = card.dataset.inboundAnonymous === "true";
    const matchesQuery = !query || name.includes(query) || username.includes(query);
    const matchesAnon =
      !anonOnly ||
      ((inboundStatus === "want" || inboundStatus === "both") && inboundAnonymous);

    if (matchesQuery && matchesAnon) {
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
      emptyState.textContent = query
        ? `No matches for "${query}" yet.`
        : "No people match those filters yet.";
      emptyState.hidden = false;
    }
  }
}

async function initLookup() {
  const container = document.getElementById("lookup-results");
  if (!container) return;

  const searchForm = document.getElementById("lookup-form");
  const searchInput = document.getElementById("lookup-input");
  const filterAnon = document.getElementById("lookup-anon-filter");
  const cards = [];
  const state = new Map();
  let emptyState = null;

  const refreshFilters = () => {
    applyLookupFilters({
      cards,
      input: searchInput,
      filterAnon,
      emptyState,
      emptyTextWhenNoCards: "No one else has joined yet.",
    });
  };

  container.innerHTML = '<p class="lookup__empty">Loading your people…</p>';

  const renderPeople = (people) => {
    cards.length = 0;
    state.clear();
    container.innerHTML = "";
    emptyState = document.createElement("p");
    emptyState.className = "lookup__empty";
    emptyState.dataset.empty = "true";
    emptyState.hidden = true;

    const fragment = document.createDocumentFragment();

    people.forEach((person) => {
      const inbound = normalizeConnectionState(person.inbound);
      const outbound = normalizeConnectionState(person.outbound);

      const card = document.createElement("article");
      card.className = "card connection";
      card.dataset.username = person.username;
      card.dataset.name = person.fullName;

      const avatarUrl = `https://api.dicebear.com/6.x/initials/svg?seed=${encodeURIComponent(
        person.username
      )}`;
      const profileHref = `profile.html?user=${encodeURIComponent(person.username)}`;
      card.innerHTML = `
        <header class="connection__header">
          <img src="${avatarUrl}" alt="${escapeHtml(person.fullName)}" />
          <div class="connection__identity">
            <h3><a href="${profileHref}">${escapeHtml(person.fullName)}</a></h3>
            <div class="user-badges" data-user-badges hidden></div>
            <p>@${escapeHtml(person.username)}</p>
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

      const usernameKey = person.username;
      state.set(usernameKey, { inbound, outbound, element: card });

      card.querySelectorAll("[data-status-button]").forEach((button) => {
        button.addEventListener("click", async () => {
          const newStatus = button.dataset.statusButton || "none";
          const entry =
            state.get(usernameKey) ?? {
              inbound: normalizeConnectionState(),
              outbound: normalizeConnectionState(),
              element: card,
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
            });
            renderCardState(card, inboundState, outboundState);
            refreshFilters();
          } catch (error) {
            state.set(usernameKey, {
              inbound: previousInbound,
              outbound: previousOutbound,
              element: card,
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
          });
          renderCardState(card, inboundState, outboundState);
          refreshFilters();
        } catch (error) {
          state.set(usernameKey, {
            inbound: currentInbound,
            outbound: currentOutbound,
            element: card,
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
        window.location.href = "messages.html";
      });

      fragment.appendChild(card);
      cards.push(card);
    });

    fragment.appendChild(emptyState);
    container.appendChild(fragment);

    refreshFilters();
  };

  if (searchForm) {
    searchForm.addEventListener("submit", (event) => event.preventDefault());
  }
  searchInput?.addEventListener("input", refreshFilters);
  filterAnon?.addEventListener("change", refreshFilters);

  try {
    await requireSession();
  } catch {
    return;
  }

  try {
    const data = await apiRequest("/lookup");
    renderPeople(data?.people ?? []);
  } catch (error) {
    console.error("Unable to load lookup", error);
    container.innerHTML = `<p class="lookup__empty">${escapeHtml(
      error?.message || "We couldn't load your people right now."
    )}</p>`;
  }
}

function renderThreadView(context, thread) {
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
  } = context;

  const inbound = normalizeConnectionState(thread.inbound);
  const outbound = normalizeConnectionState(thread.outbound);
  const inboundAnonymous = connectionIsAnonymous(inbound);

  placeholder.hidden = true;
  statusHeader.hidden = false;
  composer.hidden = false;

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

  messageLog.innerHTML = (thread.messages ?? [])
    .map((message) => {
      const outgoing = message.sender === sessionUser?.username;
      const direction = outgoing ? "outgoing" : "incoming";
      const author = outgoing ? "You" : incomingAuthor;
      const timestamp = formatTimestamp(message.createdAt);
      const meta = `${escapeHtml(author)}${
        timestamp ? ` · ${escapeHtml(timestamp)}` : ""
      }`;
      return `
        <li class="message message--${direction}">
          <span class="message__meta">${meta}</span>
          <p>${escapeHtml(message.text ?? "")}</p>
        </li>
      `;
    })
    .join("");

  if (!messageLog.innerHTML.trim()) {
    messageLog.innerHTML = "<li class=\"message message--empty\"><p>No messages yet. Say hi!</p></li>";
  }

  if (messageLog.scrollHeight) {
    messageLog.scrollTop = messageLog.scrollHeight;
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
  if (!statusHeader || !statusLabel || !title || !messageLog || !composer || !placeholder) {
    return;
  }

  newChatButton?.addEventListener("click", (event) => {
    event.preventDefault();
    window.location.href = "feed.html";
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
  };

  const fetchThreads = async () => {
    const data = await apiRequest("/messages/threads");
    return (data?.threads ?? []).map((thread) => normalizeThread(thread));
  };

  const fetchThreadDetail = async (username) => {
    const data = await apiRequest(`/messages/thread/${encodeURIComponent(username)}`);
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

    threads.sort((a, b) => timestampScore(b.updatedAt) - timestampScore(a.updatedAt));

    const fragment = document.createDocumentFragment();
    threads.forEach((thread) => {
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
      let previewText;
      if (thread.lastMessage?.text) {
        previewText = `“${escapeHtml(thread.lastMessage.text)}”`;
      } else if (inbound.status && inbound.status !== "none") {
        previewText = `${escapeHtml(thread.displayName)} marked you as ${escapeHtml(
          statusName
        )}.`;
      } else {
        previewText = "No messages yet.";
      }

      button.innerHTML = `
        <span class="${statusClass}">${escapeHtml(statusText)}</span>
        <span class="messages-list__name-row">
          <span class="messages-list__name">${escapeHtml(thread.displayName)}</span>
          <span class="user-badges user-badges--compact" data-user-badges hidden></span>
        </span>
        <span class="messages-list__preview">${previewText}</span>
      `;
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
          thread.messages = thread.messages ?? [];
          thread.messages.push(message);
          thread.lastMessage = message;
          thread.updatedAt = message.createdAt;
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
        threadMap.set(username, thread);
        const summary = threads.find((entry) => entry.username === thread.username);
        if (summary) {
          summary.inbound = thread.inbound;
          summary.outbound = thread.outbound;
          summary.displayName = thread.displayName;
          summary.badges = thread.badges;
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
          });
        }
        renderList();
      }
      activeThread = thread;
      updateListSelection(username);
      renderThreadView(context, thread);
      attachThreadControls(thread);
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
  const taglineEl = document.querySelector("[data-profile-tagline]");
  const bioEl = document.querySelector("[data-profile-bio]");
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
  const eventModalList = eventModal?.querySelector("[data-events-modal-list]");
  const eventModalEmpty = eventModal?.querySelector("[data-events-modal-empty]");
  const profileDialog = document.querySelector("[data-profile-dialog]");
  const eventDialog = document.querySelector("[data-event-dialog]");
  const postDialog = document.querySelector("[data-post-dialog]");
  const eventLimitNote = document.querySelector("[data-event-limit]");
  const postLimitNote = document.querySelector("[data-post-limit]");
  const ownOnlySections = document.querySelectorAll("[data-own-only]");

  if (!nameEl || !usernameEl || !taglineEl || !bioEl || !avatarImg || !statKnow || !statWant || !statBoth) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const requestedUser = params.get("user");

  nameEl.textContent = "Loading…";
  taglineEl.textContent = "Tell people what you're about.";
  bioEl.textContent = "Add more about yourself so people can get to know you.";

  let profileData = null;

  const toggleOwnVisibility = (canEdit) => {
    const canVerify = Boolean(profileData?.canVerify);
    ownOnlySections.forEach((section) => {
      section.hidden = !canEdit;
    });
    if (actionsContainer) {
      actionsContainer.hidden = !(canEdit || canVerify);
    }
    if (addEventButton) {
      addEventButton.hidden = !canEdit;
    }
    if (addPostButton) {
      addPostButton.hidden = !canEdit;
    }
    if (editButton) {
      editButton.hidden = !canEdit;
    }
    if (changeAvatarButton) {
      changeAvatarButton.hidden = !canEdit;
    }
    if (verifyButton) {
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
      eventRing.hidden = !events?.length;
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

  const renderEvents = () => {
    if (!eventList || !eventEmpty || !eventModalList || !eventModalEmpty) return;
    const events = profileData?.events ?? [];
    eventList.innerHTML = "";
    eventModalList.innerHTML = "";
    const hasEvents = Boolean(events.length);
    eventEmpty.hidden = hasEvents;
    eventModalEmpty.hidden = hasEvents;
    if (avatarButton) {
      avatarButton.classList.toggle("profile-summary__avatar--has-events", hasEvents);
    }
    if (eventRing) {
      eventRing.hidden = !hasEvents;
    }

    if (!hasEvents) {
      return;
    }

    events.forEach((event) => {
      const item = document.createElement("li");
      item.className = "profile-event";
      const header = document.createElement("div");
      header.className = "profile-event__header";
      const title = document.createElement("strong");
      title.textContent = event.text || "Event";
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

      if (profileData?.canEdit) {
        const actions = document.createElement("div");
        actions.className = "profile-event__actions";
        const deleteButton = document.createElement("button");
        deleteButton.className = "button button--ghost";
        deleteButton.type = "button";
        deleteButton.textContent = "Remove";
        deleteButton.addEventListener("click", async () => {
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

      const modalItem = document.createElement("li");
      modalItem.className = "events-modal__item";
      if (event.text) {
        const text = document.createElement("p");
        text.textContent = event.text;
        modalItem.appendChild(text);
      }
      if (event.attachments?.length) {
        const media = document.createElement("div");
        media.className = "events-modal__media";
        media.appendChild(createMediaFragment(event.attachments));
        modalItem.appendChild(media);
      }
      const meta = document.createElement("p");
      meta.className = "profile-event__timestamp";
      meta.textContent = formatRelativeTime(event.createdAt) || "Just now";
      modalItem.appendChild(meta);
      eventModalList.appendChild(modalItem);
    });
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
      time.textContent = formatRelativeTime(post.createdAt) || "Just now";
      header.appendChild(time);
      item.appendChild(header);

      if (post.attachments?.length) {
        const media = document.createElement("div");
        media.className = "profile-post__media";
        media.appendChild(createMediaFragment(post.attachments));
        item.appendChild(media);
      }

      if (profileData?.canEdit) {
        const actions = document.createElement("div");
        actions.className = "profile-post__actions";
        const deleteButton = document.createElement("button");
        deleteButton.className = "button button--ghost";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", async () => {
          if (!window.confirm("Delete this post?")) return;
          try {
            await apiRequest(`/posts/${encodeURIComponent(post.id)}`, { method: "DELETE" });
            profileData.posts = profileData.posts.filter((entry) => entry.id !== post.id);
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

  const renderProfile = (data) => {
    if (!data) return;
    profileData = {
      ...data,
      canVerify: Boolean(data.canVerify),
      user: {
        ...(data.user ?? {}),
      },
    };
    const user = profileData.user;
    user.badges = Array.isArray(user.badges) ? user.badges : [];
    if (profileData.canEdit) {
      sessionUser = { ...sessionUser, ...user };
    }

    nameEl.textContent = user.fullName ?? "Profile";
    usernameEl.textContent = user.username ? `@${user.username}` : "";
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

    applyAvatar(user, data.events);
    renderUserBadges(profileBadges, user.badges);

    if (verifyButton) {
      if (profileData.canVerify) {
        const isVerified = getDisplayBadges(user.badges).includes("Verified");
        verifyButton.hidden = false;
        verifyButton.disabled = false;
        verifyButton.textContent = isVerified ? "Remove verification" : "Verify user";
      } else {
        verifyButton.hidden = true;
      }
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

  verifyButton?.addEventListener("click", async () => {
    if (!profileData?.canVerify || !profileData?.user?.username) {
      return;
    }
    const currentBadges = Array.isArray(profileData.user.badges)
      ? profileData.user.badges
      : [];
    const isVerified = getDisplayBadges(currentBadges).includes("Verified");
    verifyButton.disabled = true;
    try {
      const response = await apiRequest("/badges/verify", {
        method: "POST",
        body: JSON.stringify({
          username: profileData.user.username,
          verified: !isVerified,
        }),
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

  const buildProfileUrl = () => {
    if (requestedUser) {
      return `/profile?user=${encodeURIComponent(requestedUser)}`;
    }
    return "/profile";
  };

  try {
    await requireSession();
    const data = await apiRequest(buildProfileUrl());
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
            body: JSON.stringify({ tagline: nextTagline, bio: nextBio }),
          });
          profileData.user = response?.user ?? profileData.user;
          renderProfile(profileData);
        } catch (error) {
          window.alert(error?.message || "We couldn't update your profile right now.");
        }
      })();
    } else if (profileDialog) {
      const form = profileDialog.querySelector("form");
      if (form) {
        form.elements.tagline.value = profileData.user.tagline ?? "";
        form.elements.bio.value = profileData.user.bio ?? "";
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
    const nextTagline = formData.get("tagline") ?? "";
    const nextBio = formData.get("bio") ?? "";
    try {
      const response = await apiRequest("/profile", {
        method: "PUT",
        body: JSON.stringify({ tagline: String(nextTagline), bio: String(nextBio) }),
      });
      profileData.user = response?.user ?? profileData.user;
      renderProfile(profileData);
    } catch (error) {
      window.alert(error?.message || "We couldn't update your profile right now.");
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
        profileData.events = [response.event, ...(profileData.events ?? [])];
        renderEvents();
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
        profileData.posts = [response.post, ...(profileData.posts ?? [])];
        renderPosts();
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
            profileData.events = [response.event, ...(profileData.events ?? [])];
            renderEvents();
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
            profileData.posts = [response.post, ...(profileData.posts ?? [])];
            renderPosts();
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
  };

  const openEventsModal = () => {
    if (!eventModal) return;
    eventModal.hidden = false;
    eventModal.classList.add("events-modal--open");
  };

  avatarButton?.addEventListener("click", () => {
    if (!profileData?.events?.length && !profileData?.canEdit) {
      return;
    }
    openEventsModal();
  });

  eventModal?.addEventListener("click", (event) => {
    const action = event.target?.dataset?.action;
    if (action === "close-events") {
      closeEventsModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeEventsModal();
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

document.addEventListener("DOMContentLoaded", initApp);
