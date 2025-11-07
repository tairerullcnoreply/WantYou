const STATUS_LABELS = {
  none: "Set a status",
  know: "This user knows you",
  want: "This user wants you",
  both: "This user both knows and wants you",
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

const THREADS = {
  brandon: {
    id: "brandon",
    person: "brandon.o",
    displayName: "Brandon Ortiz",
    alias: "Anonymous cyclist",
    status: "want",
    isAnonymous: true,
    messages: [
      {
        direction: "incoming",
        author: "Anonymous cyclist",
        time: "8:21 PM",
        text: "Hey! I love your route picks. Want to plan next Sunday's ride?",
      },
      {
        direction: "outgoing",
        author: "You",
        time: "8:24 PM",
        text: "Yes! I know a trail with the best sunrise. Want me to drop the map?",
      },
      {
        direction: "incoming",
        author: "Anonymous cyclist",
        time: "8:25 PM",
        text: "Absolutely. Also… I'd love to know who you are when you're ready.",
      },
    ],
  },
  imani: {
    id: "imani",
    person: "imanisingh",
    displayName: "Imani Singh",
    alias: null,
    status: "both",
    isAnonymous: false,
    messages: [
      {
        direction: "incoming",
        author: "Imani",
        time: "6:04 PM",
        text: "Study break later? I saved us a corner booth.",
      },
      {
        direction: "outgoing",
        author: "You",
        time: "6:06 PM",
        text: "Yes! I'll bring the flashcards and the orange seltzers.",
      },
    ],
  },
  avery: {
    id: "avery",
    person: "averyc",
    displayName: "Avery Chen",
    alias: null,
    status: "know",
    isAnonymous: false,
    messages: [
      {
        direction: "incoming",
        author: "Avery",
        time: "2:17 PM",
        text: "Send me the deck? We can polish the final slide tonight.",
      },
      {
        direction: "outgoing",
        author: "You",
        time: "2:20 PM",
        text: "On it! Check your inbox — I added the latest metrics.",
      },
    ],
  },
};

const PERSON_THREAD_MAP = Object.values(THREADS).reduce((acc, thread) => {
  acc[thread.person] = thread.id;
  return acc;
}, {});

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

function applyLookupFilters({ cards, input, filterAnon, emptyState }) {
  const query = input?.value.trim().toLowerCase() ?? "";
  const anonOnly = Boolean(filterAnon?.checked);
  let anyVisible = false;

  cards.forEach((card) => {
    const name = card.dataset.name?.toLowerCase() ?? "";
    const username = card.dataset.username?.toLowerCase() ?? "";
    const isAnonymous = card.dataset.anonymous === "true";
    const matchesQuery = !query || name.includes(query) || username.includes(query);
    const matchesAnon = !anonOnly || isAnonymous;

    if (matchesQuery && matchesAnon) {
      card.hidden = false;
      anyVisible = true;
    } else {
      card.hidden = true;
    }
  });

  if (emptyState) {
    if (anyVisible) {
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
  const cards = Array.from(document.querySelectorAll(".connection"));
  if (!cards.length) return;

  const searchForm = document.getElementById("lookup-form");
  const searchInput = document.getElementById("lookup-input");
  const filterAnon = document.getElementById("lookup-anon-filter");
  const emptyState = document.querySelector("[data-empty]");
  const state = new Map();

  let storedStatuses = {};
  if (getSessionToken()) {
    try {
      const data = await apiRequest("/lookup");
      storedStatuses = data?.statuses ?? {};
    } catch (error) {
      if (error.status === 401) {
        window.alert("Log in to save your Want You updates.");
      } else {
        console.warn("Unable to load saved statuses", error);
      }
    }
  }

  const renderCardState = (card, status, anonymous) => {
    card.dataset.status = status;
    card.dataset.anonymous = String(Boolean(anonymous));
    updateBadge(card, status, anonymous);
    updateChips(card, status);
    updateAnonToggle(card, status, anonymous);
  };

  const persistState = async (username, status, anonymous, onError) => {
    try {
      await apiRequest("/status", {
        method: "POST",
        body: JSON.stringify({
          targetUsername: username,
          status,
          anonymous,
        }),
      });
    } catch (error) {
      if (typeof onError === "function") {
        onError(error);
      }
    }
  };

  cards.forEach((card) => {
    const username = card.dataset.username?.toLowerCase().trim();
    const savedState = username ? storedStatuses[username] : null;
    const status = savedState?.status ?? card.dataset.status ?? "none";
    const anonymous = Boolean(savedState?.anonymous ?? (card.dataset.anonymous === "true"));
    state.set(card, { status, anonymous });
    renderCardState(card, status, anonymous);

    card.querySelectorAll("[data-status-button]").forEach((button) => {
      button.addEventListener("click", async () => {
        const newStatus = button.dataset.statusButton || "none";
        const prev = state.get(card) ?? { status: "none", anonymous: false };
        const anonymousState =
          newStatus === "want" || newStatus === "both" ? prev.anonymous : false;

        state.set(card, { status: newStatus, anonymous: anonymousState });
        renderCardState(card, newStatus, anonymousState);
        applyLookupFilters({ cards, input: searchInput, filterAnon, emptyState });
        const usernameKey = card.dataset.username;
        if (!usernameKey) {
          return;
        }
        await persistState(usernameKey, newStatus, anonymousState, (error) => {
          state.set(card, prev);
          renderCardState(card, prev.status, prev.anonymous);
          applyLookupFilters({ cards, input: searchInput, filterAnon, emptyState });
          const message =
            error?.status === 401
              ? "Log in to save your Want You updates."
              : error?.message || "We couldn't save that change.";
          window.alert(message);
        });
      });
    });

    const anonToggle = card.querySelector("[data-anonymous-toggle]");
    anonToggle?.addEventListener("change", async () => {
      const current = state.get(card) ?? { status: "none", anonymous: false };
      const canAnonymous = current.status === "want" || current.status === "both";
      const anonymousState = canAnonymous && anonToggle.checked;
      const nextState = { ...current, anonymous: anonymousState };
      state.set(card, nextState);
      renderCardState(card, nextState.status, nextState.anonymous);
      applyLookupFilters({ cards, input: searchInput, filterAnon, emptyState });
      const usernameKey = card.dataset.username;
      if (!usernameKey) {
        return;
      }
      await persistState(usernameKey, nextState.status, nextState.anonymous, (error) => {
        state.set(card, current);
        renderCardState(card, current.status, current.anonymous);
        applyLookupFilters({ cards, input: searchInput, filterAnon, emptyState });
        const message =
          error?.status === 401
            ? "Log in to save your Want You updates."
            : error?.message || "We couldn't update anonymity right now.";
        window.alert(message);
      });
    });

    const chatButton = card.querySelector("[data-chat-button]");
    chatButton?.addEventListener("click", async () => {
      const current = state.get(card) ?? {
        status: card.dataset.status || "none",
        anonymous: card.dataset.anonymous === "true",
      };
      if (current.status === "none") {
        window.alert("Choose Know you, Want you, or Both before starting a chat.");
        return;
      }
      try {
        await apiRequest("/messages/selection", {
          method: "POST",
          body: JSON.stringify({
            threadId: card.dataset.username,
            person: card.dataset.username,
            name: card.dataset.name,
            status: current.status,
            anonymous: current.anonymous,
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
  });

  if (searchForm) {
    searchForm.addEventListener("submit", (event) => event.preventDefault());
  }

  searchInput?.addEventListener("input", () =>
    applyLookupFilters({ cards, input: searchInput, filterAnon, emptyState })
  );
  filterAnon?.addEventListener("change", () =>
    applyLookupFilters({ cards, input: searchInput, filterAnon, emptyState })
  );

  if (emptyState) {
    emptyState.hidden = true;
  }

  applyLookupFilters({ cards, input: searchInput, filterAnon, emptyState });
}

function renderMessages(thread) {
  const statusBar = document.querySelector(".messages-thread__status");
  const title = document.querySelector(".messages-thread__title");
  const aliasNote = document.querySelector("[data-alias]");
  const revealToggle = document.getElementById("reveal-toggle");
  const switchAnon = document.querySelector('[data-action="switch-anon"]');
  const requestReveal = document.querySelector('[data-action="request-reveal"]');
  const messageLog = document.getElementById("message-log");

  if (!statusBar || !title || !messageLog) return;

  statusBar.textContent = STATUS_LABELS[thread.status] ?? STATUS_LABELS.none;
  title.textContent = thread.displayName;

  if (aliasNote) {
    if (thread.isAnonymous) {
      aliasNote.innerHTML = `You appear as <strong>${thread.alias ?? "Anonymous"}</strong>`;
      aliasNote.hidden = false;
    } else {
      aliasNote.hidden = true;
    }
  }

  if (revealToggle) {
    const canReveal = thread.status === "want" || thread.status === "both";
    revealToggle.disabled = !canReveal;
    revealToggle.checked = canReveal && !thread.isAnonymous;
    revealToggle.parentElement?.classList.toggle("toggle--disabled", !canReveal);
    revealToggle.onchange = () => {
      thread.isAnonymous = !revealToggle.checked;
      renderMessages(thread);
    };
  }

  if (switchAnon) {
    const canAnonymous = thread.status === "want" || thread.status === "both";
    switchAnon.disabled = !canAnonymous;
    switchAnon.textContent = thread.isAnonymous
      ? "Stay anonymous"
      : canAnonymous
      ? "Go anonymous"
      : "Anonymity not available";
    if (canAnonymous) {
      switchAnon.onclick = () => {
        thread.isAnonymous = true;
        renderMessages(thread);
      };
    } else {
      switchAnon.onclick = null;
    }
  }

  if (requestReveal) {
    requestReveal.disabled = !thread.isAnonymous;
    requestReveal.onclick = () => {
      window.alert("Request to reveal sent. They'll decide when to make it public.");
    };
  }

  messageLog.innerHTML = thread.messages
    .map(
      (message) => `
        <li class="message message--${message.direction}">
          <span class="message__meta">${message.author} · ${message.time}</span>
          <p>${message.text}</p>
        </li>
      `
    )
    .join("");
}

async function initMessages() {
  const listItems = Array.from(document.querySelectorAll(".messages-list__item"));
  if (!listItems.length) return;

  const composer = document.getElementById("message-composer");
  const input = document.getElementById("message-input");
  let activeThread = THREADS[listItems[0].dataset.thread ?? ""];

  const storedThread = await (async () => {
    if (!getSessionToken()) return null;
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

  if (storedThread) {
    const mappedId = PERSON_THREAD_MAP[storedThread.person ?? ""];
    if (mappedId && THREADS[mappedId]) {
      activeThread = THREADS[mappedId];
    } else {
      activeThread = {
        id: storedThread.threadId ?? storedThread.person ?? "custom",
        person: storedThread.person ?? "custom",
        displayName: storedThread.name ?? "Unknown user",
        alias: storedThread.anonymous ? "Anonymous" : null,
        status: storedThread.status ?? "none",
        isAnonymous: Boolean(storedThread.anonymous),
        messages: [
          {
            direction: "incoming",
            author: storedThread.anonymous
              ? "Anonymous"
              : storedThread.name ?? "Friend",
            time: "Just now",
            text: "Say hi to keep the chat going!",
          },
        ],
      };
    }
  }

  const activateListItem = (threadId) => {
    listItems.forEach((item) => {
      const isActive = item.dataset.thread === threadId;
      item.setAttribute("aria-current", String(isActive));
      item.classList.toggle("messages-list__item--active", isActive);
    });
  };

  listItems.forEach((item) => {
    item.addEventListener("click", () => {
      const threadId = item.dataset.thread;
      if (!threadId) return;
      const nextThread = THREADS[threadId];
      if (!nextThread) return;
      activeThread = nextThread;
      activateListItem(threadId);
      renderMessages(activeThread);
    });
  });

  activateListItem(activeThread?.id ?? "");
  if (activeThread) {
    renderMessages(activeThread);
  }

  composer?.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input?.value.trim();
    if (!text || !activeThread) return;

    activeThread.messages.push({
      direction: "outgoing",
      author: "You",
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      text,
    });
    renderMessages(activeThread);
    if (input) {
      input.value = "";
      input.focus();
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
      // Profile currently uses static data only.
      break;
    default:
      break;
  }
}

document.addEventListener("DOMContentLoaded", initApp);
