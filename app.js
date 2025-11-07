const STATUS_LABELS = {
  none: "No status yet",
  know: "This user knows you",
  want: "This user wants you",
  both: "This user both knows and wants you",
};

const STATUS_NAMES = {
  none: "None",
  know: "Know you",
  want: "Want you",
  both: "Both",
};

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

const DEFAULT_CONNECTION = { status: "none", anonymous: false, updatedAt: null };
let sessionUser = null;

function escapeHtml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  return state.status === "want" || state.status === "both";
}

function describeOutbound(status, anonymous) {
  switch (status) {
    case "know":
      return "You marked that you know them.";
    case "want":
      return anonymous
        ? "You marked that you want them and you're staying anonymous."
        : "You marked that you want them.";
    case "both":
      return anonymous
        ? "You marked them as Both and you're staying anonymous."
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
  note.textContent = describeOutbound(outbound.status, outbound.anonymous);
}

function renderCardState(card, inbound, outbound) {
  card.dataset.inboundStatus = inbound.status ?? "none";
  card.dataset.inboundAnonymous = String(Boolean(inbound.anonymous));
  card.dataset.outboundStatus = outbound.status ?? "none";
  card.dataset.outboundAnonymous = String(Boolean(outbound.anonymous));
  updateBadge(card, inbound.status, inbound.anonymous);
  updateChips(card, outbound.status);
  updateAnonToggle(card, outbound.status, outbound.anonymous);
  setOutboundNote(card, outbound);
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
      const inbound = person.inbound ? { ...person.inbound } : { ...DEFAULT_CONNECTION };
      const outbound = person.outbound ? { ...person.outbound } : { ...DEFAULT_CONNECTION };

      const card = document.createElement("article");
      card.className = "card connection";
      card.dataset.username = person.username;
      card.dataset.name = person.fullName;

      const avatarUrl = `https://api.dicebear.com/6.x/initials/svg?seed=${encodeURIComponent(
        person.username
      )}`;
      card.innerHTML = `
        <header class="connection__header">
          <img src="${avatarUrl}" alt="${escapeHtml(person.fullName)}" />
          <div>
            <h3>${escapeHtml(person.fullName)}</h3>
            <p>@${escapeHtml(person.username)}</p>
          </div>
          <span class="connection__badge" data-badge></span>
        </header>
        <p class="connection__bio">${
          person.tagline ? escapeHtml(person.tagline) : "No bio yet."
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

      renderCardState(card, inbound, outbound);

      const usernameKey = person.username;
      state.set(usernameKey, { inbound, outbound, element: card });

      card.querySelectorAll("[data-status-button]").forEach((button) => {
        button.addEventListener("click", async () => {
          const newStatus = button.dataset.statusButton || "none";
          const entry = state.get(usernameKey) ?? {
            inbound: { ...DEFAULT_CONNECTION },
            outbound: { ...DEFAULT_CONNECTION },
            element: card,
          };
          const previousOutbound = entry.outbound;
          const nextOutbound = {
            status: newStatus,
            anonymous:
              newStatus === "want" || newStatus === "both"
                ? previousOutbound.anonymous
                : false,
            updatedAt: new Date().toISOString(),
          };

          state.set(usernameKey, { ...entry, outbound: nextOutbound });
          renderCardState(card, entry.inbound, nextOutbound);
          refreshFilters();

          try {
            const result = await apiRequest("/status", {
              method: "POST",
              body: JSON.stringify({
                targetUsername: usernameKey,
                status: newStatus,
                anonymous: nextOutbound.anonymous,
              }),
            });
            const connection = result?.connection;
            const inboundState =
              connection?.inbound ?? state.get(usernameKey)?.inbound ?? entry.inbound;
            const outboundState =
              connection?.outbound ?? state.get(usernameKey)?.outbound ?? nextOutbound;
            state.set(usernameKey, {
              inbound: inboundState,
              outbound: outboundState,
              element: card,
            });
            renderCardState(card, inboundState, outboundState);
            refreshFilters();
          } catch (error) {
            state.set(usernameKey, { ...entry, outbound: previousOutbound });
            renderCardState(card, entry.inbound, previousOutbound);
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
        const canAnonymous =
          entry.outbound.status === "want" || entry.outbound.status === "both";
        const nextOutbound = {
          ...entry.outbound,
          anonymous: canAnonymous && anonToggle.checked,
          updatedAt: new Date().toISOString(),
        };
        state.set(usernameKey, { ...entry, outbound: nextOutbound });
        renderCardState(card, entry.inbound, nextOutbound);
        refreshFilters();

        try {
          const result = await apiRequest("/status", {
            method: "POST",
            body: JSON.stringify({
              targetUsername: usernameKey,
              status: nextOutbound.status,
              anonymous: nextOutbound.anonymous,
            }),
          });
          const connection = result?.connection;
          const inboundState =
            connection?.inbound ?? state.get(usernameKey)?.inbound ?? entry.inbound;
          const outboundState =
            connection?.outbound ?? state.get(usernameKey)?.outbound ?? nextOutbound;
          state.set(usernameKey, {
            inbound: inboundState,
            outbound: outboundState,
            element: card,
          });
          renderCardState(card, inboundState, outboundState);
          refreshFilters();
        } catch (error) {
          state.set(usernameKey, entry);
          renderCardState(card, entry.inbound, entry.outbound);
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
    aliasNote,
    revealToggle,
    switchAnon,
    requestReveal,
    messageLog,
    composer,
    placeholder,
  } = context;

  const inbound = thread.inbound ? { ...thread.inbound } : { ...DEFAULT_CONNECTION };
  const outbound = thread.outbound ? { ...thread.outbound } : { ...DEFAULT_CONNECTION };

  placeholder.hidden = true;
  statusHeader.hidden = false;
  composer.hidden = false;

  statusLabel.textContent = STATUS_LABELS[inbound.status] ?? STATUS_LABELS.none;
  title.textContent = thread.displayName;

  if (aliasNote) {
    if (outbound.status === "want" || outbound.status === "both") {
      if (outbound.anonymous) {
        aliasNote.innerHTML = "They currently see you as <strong>Anonymous</strong>.";
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
    const inboundAnonymous =
      (inbound.status === "want" || inbound.status === "both") && inbound.anonymous;
    requestReveal.disabled = !inboundAnonymous;
  }

  const incomingAuthor =
    (inbound.status === "want" || inbound.status === "both") && inbound.anonymous
      ? "Anonymous"
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
    return data?.threads ?? [];
  };

  const fetchThreadDetail = async (username) => {
    const data = await apiRequest(`/messages/thread/${encodeURIComponent(username)}`);
    return data?.thread ?? null;
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

      const statusClass = tagClassForStatus(thread.inbound?.status ?? "none");
      const statusText =
        STATUS_LABELS[thread.inbound?.status ?? "none"] ?? STATUS_LABELS.none;
      const statusName =
        STATUS_NAMES[thread.inbound?.status ?? "none"] ??
        thread.inbound?.status ??
        "none";
      let previewText;
      if (thread.lastMessage?.text) {
        previewText = `“${escapeHtml(thread.lastMessage.text)}”`;
      } else if (thread.inbound?.status && thread.inbound.status !== "none") {
        previewText = `${escapeHtml(thread.displayName)} marked you as ${escapeHtml(
          statusName
        )}.`;
      } else {
        previewText = "No messages yet.";
      }

      button.innerHTML = `
        <span class="${statusClass}">${escapeHtml(statusText)}</span>
        <span class="messages-list__name">${escapeHtml(thread.displayName)}</span>
        <span class="messages-list__preview">${previewText}</span>
      `;
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
    const outbound = thread.outbound ?? { ...DEFAULT_CONNECTION };
    if (outbound.status !== "want" && outbound.status !== "both") {
      return;
    }
    try {
      const result = await apiRequest("/status", {
        method: "POST",
        body: JSON.stringify({
          targetUsername: thread.username,
          status: outbound.status,
          anonymous,
        }),
      });
      const connection = result?.connection;
      if (connection) {
        thread.outbound = connection.outbound ?? thread.outbound;
        thread.inbound = connection.inbound ?? thread.inbound;
        thread.updatedAt =
          connection.outbound?.updatedAt ??
          connection.inbound?.updatedAt ??
          thread.updatedAt ??
          null;
        threadMap.set(thread.username, thread);
        const summary = threads.find((entry) => entry.username === thread.username);
        if (summary) {
          summary.outbound = thread.outbound;
          summary.inbound = thread.inbound;
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
      renderThreadView(context, thread);
      attachThreadControls(thread);
    }
  };

  const attachThreadControls = (thread) => {
    const outbound = thread.outbound ?? { ...DEFAULT_CONNECTION };
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
        const latest = thread.outbound ?? { ...DEFAULT_CONNECTION };
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
        } else {
          threads.push({
            username: thread.username,
            fullName: thread.fullName,
            displayName: thread.displayName,
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
  const avatarEl = document.querySelector("[data-profile-avatar]");
  const statKnow = document.getElementById("stat-know");
  const statWant = document.getElementById("stat-want");
  const statBoth = document.getElementById("stat-both");
  const anonList = document.getElementById("profile-anon-list");
  const recentList = document.getElementById("profile-recent-list");
  const editButton = document.querySelector('[data-action="edit-profile"]');

  if (
    !nameEl ||
    !usernameEl ||
    !taglineEl ||
    !statKnow ||
    !statWant ||
    !statBoth ||
    !anonList ||
    !recentList
  ) {
    return;
  }

  nameEl.textContent = "Loading…";
  taglineEl.textContent = "Tell people what you're about.";

  let profileData = null;

  const renderProfile = (data) => {
    if (!data) return;
    profileData = data;
    const user = data.user ?? sessionUser ?? {};
    sessionUser = { ...sessionUser, ...user };

    nameEl.textContent = user.fullName ?? "Your profile";
    usernameEl.textContent = user.username ? `@${user.username}` : "";
    taglineEl.textContent = user.tagline ? user.tagline : "Tell people what you're about.";
    taglineEl.classList.toggle("profile-summary__tagline--empty", !user.tagline);

    if (avatarEl) {
      if (user.username) {
        avatarEl.src = `https://api.dicebear.com/6.x/initials/svg?seed=${encodeURIComponent(
          user.username
        )}`;
        avatarEl.alt = user.fullName ? `${user.fullName}'s avatar` : "Profile avatar";
      } else {
        avatarEl.removeAttribute("src");
        avatarEl.alt = "Profile avatar";
      }
    }

    statKnow.textContent = String(data.stats?.know ?? 0);
    statWant.textContent = String(data.stats?.want ?? 0);
    statBoth.textContent = String(data.stats?.both ?? 0);

    anonList.innerHTML = "";
    if (!data.anonymous?.length) {
      const emptyItem = document.createElement("li");
      emptyItem.dataset.emptyAnon = "true";
      emptyItem.textContent = "No anonymous Want Yous yet.";
      anonList.appendChild(emptyItem);
    } else {
      data.anonymous.forEach((entry) => {
        const li = document.createElement("li");
        const info = document.createElement("div");
        const name = document.createElement("h3");
        name.textContent = entry.fullName ?? entry.username;
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
    }

    recentList.innerHTML = "";
    if (!data.recent?.length) {
      const emptyItem = document.createElement("li");
      emptyItem.dataset.emptyRecent = "true";
      emptyItem.textContent = "No recent updates yet.";
      recentList.appendChild(emptyItem);
    } else {
      data.recent.forEach((entry) => {
        const li = document.createElement("li");
        const info = document.createElement("div");
        const name = document.createElement("h3");
        name.textContent = entry.fullName ?? entry.username;
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
        li.appendChild(tag);
        recentList.appendChild(li);
      });
    }
  };

  try {
    await requireSession();
    const data = await apiRequest("/profile");
    renderProfile(data);
  } catch (error) {
    console.error("Unable to load profile", error);
    taglineEl.textContent =
      error?.message || "We couldn't load your profile right now.";
  }

  editButton?.addEventListener("click", async () => {
    if (!profileData?.user) return;
    const currentTagline = profileData.user.tagline ?? "";
    const nextTagline = window.prompt("Update your tagline", currentTagline);
    if (nextTagline === null) {
      return;
    }
    try {
      const response = await apiRequest("/profile", {
        method: "PUT",
        body: JSON.stringify({ tagline: nextTagline }),
      });
      profileData.user = response?.user ?? profileData.user;
      renderProfile(profileData);
    } catch (error) {
      window.alert(error?.message || "We couldn't update your profile right now.");
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
