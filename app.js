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
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector("input[type='email']");
      if (!input?.value) return;
      form.classList.add("form--submitted");
      form.innerHTML = `<p class="form__success">Invite requested! We'll email you shortly.</p>`;
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

  signupForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    window.alert("Account created! Check your inbox to verify.");
  });

  loginForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    window.alert("Logged in! Redirecting you to your lookup.");
    window.location.href = "feed.html";
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

function initLookup() {
  const cards = Array.from(document.querySelectorAll(".connection"));
  if (!cards.length) return;

  const searchForm = document.getElementById("lookup-form");
  const searchInput = document.getElementById("lookup-input");
  const filterAnon = document.getElementById("lookup-anon-filter");
  const emptyState = document.querySelector("[data-empty]");
  const state = new Map();

  cards.forEach((card) => {
    const status = card.dataset.status || "none";
    const anonymous = card.dataset.anonymous === "true";
    state.set(card, { status, anonymous });
    updateBadge(card, status, anonymous);
    updateChips(card, status);
    updateAnonToggle(card, status, anonymous);

    card.querySelectorAll("[data-status-button]").forEach((button) => {
      button.addEventListener("click", () => {
        const newStatus = button.dataset.statusButton || "none";
        const prev = state.get(card) ?? { status: "none", anonymous: false };
        const anonymousState =
          newStatus === "want" || newStatus === "both" ? prev.anonymous : false;

        state.set(card, { status: newStatus, anonymous: anonymousState });
        card.dataset.status = newStatus;
        card.dataset.anonymous = String(anonymousState);
        updateBadge(card, newStatus, anonymousState);
        updateChips(card, newStatus);
        updateAnonToggle(card, newStatus, anonymousState);
        applyLookupFilters({ cards, input: searchInput, filterAnon, emptyState });
      });
    });

    const anonToggle = card.querySelector("[data-anonymous-toggle]");
    anonToggle?.addEventListener("change", () => {
      const current = state.get(card) ?? { status: "none", anonymous: false };
      const canAnonymous = current.status === "want" || current.status === "both";
      const anonymousState = canAnonymous && anonToggle.checked;
      state.set(card, { ...current, anonymous: anonymousState });
      card.dataset.anonymous = String(anonymousState);
      updateBadge(card, current.status, anonymousState);
      applyLookupFilters({ cards, input: searchInput, filterAnon, emptyState });
    });

    const chatButton = card.querySelector("[data-chat-button]");
    chatButton?.addEventListener("click", () => {
      const current = state.get(card) ?? { status: card.dataset.status || "none", anonymous: card.dataset.anonymous === "true" };
      if (current.status === "none") {
        window.alert("Choose Know you, Want you, or Both before starting a chat.");
        return;
      }
      const payload = {
        person: card.dataset.username,
        name: card.dataset.name,
        status: current.status,
        anonymous: current.anonymous,
      };
      try {
        window.localStorage.setItem("wantyou_selectedThread", JSON.stringify(payload));
      } catch (error) {
        console.warn("Unable to persist selected thread", error);
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

function initMessages() {
  const listItems = Array.from(document.querySelectorAll(".messages-list__item"));
  if (!listItems.length) return;

  const composer = document.getElementById("message-composer");
  const input = document.getElementById("message-input");
  let activeThread = THREADS[listItems[0].dataset.thread ?? ""];

  const storedThread = (() => {
    try {
      const raw = window.localStorage.getItem("wantyou_selectedThread");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.warn("Unable to parse stored thread", error);
      return null;
    }
  })();

  if (storedThread) {
    const mappedId = PERSON_THREAD_MAP[storedThread.person ?? ""];
    if (mappedId && THREADS[mappedId]) {
      activeThread = THREADS[mappedId];
    } else {
      activeThread = {
        id: storedThread.person ?? "custom",
        person: storedThread.person ?? "custom",
        displayName: storedThread.name ?? "Unknown user",
        alias: storedThread.anonymous ? "Anonymous" : null,
        status: storedThread.status ?? "none",
        isAnonymous: Boolean(storedThread.anonymous),
        messages: [
          {
            direction: "incoming",
            author: storedThread.anonymous ? "Anonymous" : storedThread.name ?? "Friend",
            time: "Just now",
            text: "Say hi to keep the chat going!",
          },
        ],
      };
    }
    try {
      window.localStorage.removeItem("wantyou_selectedThread");
    } catch (error) {
      console.warn("Unable to clear stored thread", error);
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
