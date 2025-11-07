const state = {
  currentUser: null,
  selectedUserId: null,
  users: [
    {
      id: crypto.randomUUID(),
      fullName: "Riley Anderson",
      username: "riley",
      password: "password",
      relationship: { status: "both", anonymous: false },
      conversations: [
        {
          id: crypto.randomUUID(),
          heading: "This user both knows and wants you",
          messages: [
            {
              id: crypto.randomUUID(),
              author: "You",
              body: "Loved getting coffee yesterday! Want to plan something this weekend?",
              timestamp: new Date(Date.now() - 3600 * 1000 * 5),
              anonymous: false,
            },
            {
              id: crypto.randomUUID(),
              author: "Riley",
              body: "Absolutely! How about the new rooftop cinema on Saturday night?",
              timestamp: new Date(Date.now() - 3600 * 1000 * 4.2),
              anonymous: false,
            },
          ],
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      fullName: "Dominique Smith",
      username: "nico",
      password: "password",
      relationship: { status: "want", anonymous: true },
      conversations: [
        {
          id: crypto.randomUUID(),
          heading: "This user wants you",
          messages: [
            {
              id: crypto.randomUUID(),
              author: "You (anonymous)",
              body: "Hey there! I heard you're into hiking. Want to swap trail recommendations?",
              timestamp: new Date(Date.now() - 3600 * 1000 * 24),
              anonymous: true,
            },
            {
              id: crypto.randomUUID(),
              author: "Dominique",
              body: "I'd love that! Anonymous trail friend, what's your favorite sunrise spot?",
              timestamp: new Date(Date.now() - 3600 * 1000 * 22.5),
              anonymous: false,
            },
          ],
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      fullName: "Zara Patel",
      username: "zara",
      password: "password",
      relationship: { status: "know", anonymous: false },
      conversations: [
        {
          id: crypto.randomUUID(),
          heading: "This user knows you",
          messages: [
            {
              id: crypto.randomUUID(),
              author: "Zara",
              body: "Thanks again for the portfolio feedback! Want to grab lunch next week?",
              timestamp: new Date(Date.now() - 3600 * 1000 * 48),
              anonymous: false,
            },
          ],
        },
      ],
    },
  ],
};

const select = (selector) => document.querySelector(selector);
const selectAll = (selector) => document.querySelectorAll(selector);

const elements = {
  highlightCard: select("#highlight-card"),
  authPanel: select("#auth-panel"),
  discoverPanel: select("#discover-panel"),
  detailsTitle: select("#details-title"),
  detailsSubtitle: select("#details-subtitle"),
  relationship: select("#relationship"),
  conversation: select("#conversation"),
  conversationHeading: select("#conversation-heading"),
  conversationStatus: select("#conversation-status"),
  conversationMessages: select("#conversation-messages"),
  messageForm: select("#message-form"),
  messageInput: select("#message-input"),
  messageAnon: select("#message-anon"),
  anonymousToggle: select("#anonymous-toggle"),
  searchInput: select("#search-input"),
  clearSearch: select("#clear-search"),
  userList: select("#user-list"),
  year: select("#year"),
};

const templates = {
  userItem: select("#user-item-template"),
  message: select("#message-template"),
};

const tabButtons = {
  login: select("#login-tab-btn"),
  register: select("#register-tab-btn"),
};

const tabPanels = {
  login: select("#login-tab"),
  register: select("#register-tab"),
};

const forms = {
  login: select("#login-tab"),
  register: select("#register-tab"),
};

const inputs = {
  loginUsername: select("#login-username"),
  loginPassword: select("#login-password"),
  registerFullname: select("#register-fullname"),
  registerUsername: select("#register-username"),
  registerPassword: select("#register-password"),
};

const formatTimestamp = (date) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(date);

const headingByStatus = {
  none: "Start a conversation",
  know: "This user knows you",
  want: "This user wants you",
  both: "This user both knows and wants you",
};

const statusBadges = {
  none: "No status",
  know: "Knows you",
  want: "Wants you",
  both: "Knows & wants you",
};

const heroHighlights = [
  {
    title: "Mutual sparks",
    copy: "See the people who both know and want you. When both sides opt in, conversations open instantly.",
    tag: "Both",
  },
  {
    title: "Anonymous admiration",
    copy: "Mark someone as a Want You anonymously. Chat safely and reveal yourself when you both feel ready.",
    tag: "Anonymous",
  },
  {
    title: "Low pressure intros",
    copy: "Let friends know you remember them. A simple Know You can be the start of something more.",
    tag: "Know you",
  },
];

function cycleHighlights() {
  let index = 0;
  const render = () => {
    const highlight = heroHighlights[index];
    elements.highlightCard.innerHTML = `
      <span class="tag">${highlight.tag}</span>
      <h3>${highlight.title}</h3>
      <p>${highlight.copy}</p>
    `;
    index = (index + 1) % heroHighlights.length;
  };
  render();
  setInterval(render, 6000);
}

function setYear() {
  elements.year.textContent = new Date().getFullYear();
}

function handleTabChange(active) {
  Object.entries(tabButtons).forEach(([key, button]) => {
    const isActive = key === active;
    button.classList.toggle("tab--active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  Object.entries(tabPanels).forEach(([key, panel]) => {
    const isActive = key === active;
    panel.classList.toggle("tab-panel--active", isActive);
    panel.hidden = !isActive;
  });
}

function renderUsers(list = state.users) {
  elements.userList.innerHTML = "";
  list.forEach((user) => {
    const clone = templates.userItem.content.firstElementChild.cloneNode(true);
    const button = clone.querySelector(".user__card");
    const name = clone.querySelector(".user__name");
    const username = clone.querySelector(".user__username");
    const status = clone.querySelector(".user__status");

    name.textContent = user.fullName;
    username.textContent = `@${user.username}`;
    status.textContent = statusBadges[user.relationship.status];

    button.dataset.userId = user.id;
    button.addEventListener("click", () => selectUser(user.id));
    elements.userList.appendChild(clone);
  });
}

function selectUser(userId) {
  state.selectedUserId = userId;
  const user = state.users.find((item) => item.id === userId);
  if (!user) return;

  elements.detailsTitle.textContent = user.fullName;
  elements.detailsSubtitle.textContent = `@${user.username}`;
  elements.relationship.hidden = false;
  elements.conversation.hidden = false;

  const statusInputs = selectAll('input[name="status"]');
  statusInputs.forEach((input) => {
    input.checked = input.value === user.relationship.status;
    input.onchange = () => updateRelationship(input.value);
  });

  elements.anonymousToggle.checked = user.relationship.anonymous;
  elements.anonymousToggle.onchange = (event) =>
    updateAnonymous(event.target.checked);

  renderConversation(user);
}

function updateRelationship(status) {
  const user = state.users.find((item) => item.id === state.selectedUserId);
  if (!user) return;
  user.relationship.status = status;
  if (user.conversations[0]) {
    user.conversations[0].heading = headingByStatus[status];
  }
  if (status !== "want") {
    user.relationship.anonymous = false;
    elements.anonymousToggle.checked = false;
  }
  renderConversation(user);
  renderUsers(filteredUsers());
}

function updateAnonymous(isAnonymous) {
  const user = state.users.find((item) => item.id === state.selectedUserId);
  if (!user) return;
  if (user.relationship.status === "want") {
    user.relationship.anonymous = isAnonymous;
  } else {
    user.relationship.anonymous = false;
    elements.anonymousToggle.checked = false;
  }
  renderConversation(user);
  renderUsers(filteredUsers());
}

function renderConversation(user) {
  const conversation = user.conversations[0];
  const status = user.relationship.status;
  const heading = headingByStatus[status];
  const isAnonymous = user.relationship.anonymous;

  elements.conversationHeading.textContent = heading;
  elements.conversationStatus.textContent =
    status === "want" && isAnonymous
      ? "Anonymous"
      : statusBadges[status];

  elements.conversationMessages.innerHTML = "";
  if (!conversation) {
    elements.conversationMessages.innerHTML =
      '<li class="message"><p class="message__body">No messages yet. Say hello!</p></li>';
    return;
  }

  conversation.messages
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .forEach((message) => {
      const clone = templates.message.content.firstElementChild.cloneNode(true);
      clone.querySelector(".message__author").textContent = message.author;
      clone.querySelector(".message__timestamp").textContent = formatTimestamp(
        message.timestamp,
      );
      clone.querySelector(".message__body").textContent = message.body;
      if (message.anonymous) {
        clone.classList.add("message--anonymous");
      }
      elements.conversationMessages.appendChild(clone);
    });
}

function filteredUsers() {
  const term = elements.searchInput.value.trim().toLowerCase();
  if (!term) return state.users;
  return state.users.filter(
    (user) =>
      user.fullName.toLowerCase().includes(term) ||
      user.username.toLowerCase().includes(term),
  );
}

function handleSearchInput() {
  renderUsers(filteredUsers());
}

function handleClearSearch() {
  elements.searchInput.value = "";
  renderUsers(state.users);
  elements.searchInput.focus();
}

function handleLogin(event) {
  event.preventDefault();
  const username = inputs.loginUsername.value.trim().toLowerCase();
  const password = inputs.loginPassword.value;
  const user = state.users.find(
    (item) => item.username.toLowerCase() === username && item.password === password,
  );
  if (!user) {
    alert("We couldn't find that account. Try again or create a new one.");
    return;
  }
  state.currentUser = user;
  selectUser(user.id);
  elements.authPanel.classList.add("panel--collapsed");
}

function resetRegisterForm() {
  inputs.registerFullname.value = "";
  inputs.registerUsername.value = "";
  inputs.registerPassword.value = "";
}

function handleRegister(event) {
  event.preventDefault();
  const fullName = inputs.registerFullname.value.trim();
  const username = inputs.registerUsername.value.trim();
  const password = inputs.registerPassword.value;

  if (!fullName || !username || !password) {
    alert("Please fill in all fields to create an account.");
    return;
  }

  if (state.users.some((user) => user.username === username)) {
    alert("That username is already taken. Try another one.");
    return;
  }

  const newUser = {
    id: crypto.randomUUID(),
    fullName,
    username,
    password,
    relationship: { status: "none", anonymous: false },
    conversations: [
      {
        id: crypto.randomUUID(),
        heading: headingByStatus.none,
        messages: [],
      },
    ],
  };

  state.users = [newUser, ...state.users];
  resetRegisterForm();
  renderUsers(state.users);
  selectUser(newUser.id);
  state.currentUser = newUser;
  elements.authPanel.classList.add("panel--collapsed");
}

function handleMessageSubmit(event) {
  event.preventDefault();
  const body = elements.messageInput.value.trim();
  if (!body) return;
  const user = state.users.find((item) => item.id === state.selectedUserId);
  if (!user) return;

  const conversation = user.conversations[0];
  const anonymous = elements.messageAnon.checked;
  const author = anonymous ? "You (anonymous)" : "You";

  conversation.messages.push({
    id: crypto.randomUUID(),
    author,
    body,
    timestamp: new Date(),
    anonymous,
  });

  elements.messageInput.value = "";
  elements.messageAnon.checked = false;
  renderConversation(user);
}

function initEvents() {
  tabButtons.login.addEventListener("click", () => handleTabChange("login"));
  tabButtons.register.addEventListener("click", () => handleTabChange("register"));

  forms.login.addEventListener("submit", handleLogin);
  forms.register.addEventListener("submit", handleRegister);
  elements.messageForm.addEventListener("submit", handleMessageSubmit);

  elements.searchInput.addEventListener("input", handleSearchInput);
  elements.clearSearch.addEventListener("click", handleClearSearch);

  selectAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.open;
      const panel = target === "auth" ? elements.authPanel : elements.discoverPanel;
      panel.scrollIntoView({ behavior: "smooth" });
    });
  });
}

function init() {
  cycleHighlights();
  setYear();
  handleTabChange("login");
  renderUsers(state.users);
  initEvents();
}

init();
