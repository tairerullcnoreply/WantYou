const STATE = {
  likes: new Map(),
  conversations: {},
};

const heroMessages = [
  {
    quote: "“Team Launch hit their milestone — Jordan kept us on track!”",
    author: "Avery · Product Circle",
  },
  {
    quote: "“Weekend Warrior crew is cheering Mia on for the big race.”",
    author: "Anthony · Climber Crew",
  },
  {
    quote: "“Emma just unlocked a new boost streak. Show her some love!”",
    author: "Community Highlights",
  },
];

const messageData = [
  {
    id: "launch",
    title: "Launch Crew",
    meta: "4 members · Anonymous",
    anonymous: true,
    messages: [
      {
        author: "Anonymous",
        text: "Demo flow is slick. Proud of this launch team!",
        time: "9:12 AM",
      },
      {
        author: "You",
        text: "Schedule dry run at noon?",
        time: "9:14 AM",
      },
    ],
  },
  {
    id: "warriors",
    title: "Weekend Warriors",
    meta: "8 members",
    anonymous: false,
    messages: [
      {
        author: "Mia",
        text: "Anyone bringing the orange slices?",
        time: "8:02 AM",
      },
      {
        author: "Jordan",
        text: "Already packed them!",
        time: "8:05 AM",
      },
    ],
  },
  {
    id: "emma",
    title: "Boosts for Emma",
    meta: "DM · Anonymous",
    anonymous: true,
    messages: [
      {
        author: "Anonymous",
        text: "You’re going to nail the pitch today!",
        time: "Yesterday",
      },
    ],
  },
];

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
      const { quote, author } = heroMessages[heroIndex % heroMessages.length];
      heroCard.innerHTML = `
        <div class="hero-card__content">
          <p>${quote}</p>
          <span>${author}</span>
        </div>
      `;
      heroIndex += 1;
    };

    renderHero();
    setInterval(renderHero, 5000);
  }

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector("input[type='email']");
      if (!input?.value) return;
      form.classList.add("form--submitted");
      form.innerHTML = `<p class="form__success">Invite requested! Check your inbox soon.</p>`;
    });
  }
}

function initSignup() {
  const form = document.getElementById("signup-form");
  const year = document.getElementById("signup-year");

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    window.alert("Account created! Check your inbox to verify your email.");
  });
}

function initFeed() {
  const composerForm = document.getElementById("composer-form");
  const composerText = document.getElementById("composer-text");
  const postsContainer = document.getElementById("feed-posts");

  document.querySelectorAll('[data-action="like"]').forEach((button) => {
    button.addEventListener("click", () => {
      const label = button.querySelector(".post__action-label");
      const post = button.closest("[data-post]");
      if (!label || !post) return;

      const postId = STATE.likes.get(post) ?? {
        liked: false,
        count: Number(label.textContent) || 0,
      };

      if (postId.liked) {
        postId.count = Math.max(0, postId.count - 1);
        button.classList.remove("post__action--active");
      } else {
        postId.count += 1;
        button.classList.add("post__action--active");
      }

      postId.liked = !postId.liked;
      label.textContent = String(postId.count);
      STATE.likes.set(post, postId);
    });
  });

  document.querySelectorAll('[data-action="join"]').forEach((button) => {
    button.addEventListener("click", () => {
      button.textContent = "Joined";
      button.disabled = true;
    });
  });

  if (composerForm && composerText && postsContainer) {
    composerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = composerText.value.trim();
      if (!text) return;

      const newPost = document.createElement("article");
      newPost.className = "card post";
      newPost.dataset.post = "";
      newPost.innerHTML = `
        <header class="post__header">
          <img src="https://i.pravatar.cc/48?img=5" alt="Profile" />
          <div>
            <h3>Jordan Lee</h3>
            <p>Shared to Launch Crew · just now</p>
          </div>
        </header>
        <p>${text}</p>
        <footer class="post__footer">
          <button class="post__action" data-action="like">
            <span aria-hidden="true">❤️</span>
            <span class="post__action-label">1</span>
          </button>
          <button class="post__action" data-action="comment">
            💬 <span class="post__action-label">0</span>
          </button>
          <button class="post__action" data-action="share">↗︎ Share</button>
        </footer>
      `;

      postsContainer.prepend(newPost);
      composerText.value = "";

      const likeButton = newPost.querySelector('[data-action="like"]');
      if (likeButton) {
        likeButton.addEventListener("click", () => {
          const label = likeButton.querySelector(".post__action-label");
          if (!label) return;

          const status = STATE.likes.get(newPost) ?? { liked: false, count: 1 };
          if (status.liked) {
            status.count = Math.max(0, status.count - 1);
            likeButton.classList.remove("post__action--active");
          } else {
            status.count += 1;
            likeButton.classList.add("post__action--active");
          }
          status.liked = !status.liked;
          label.textContent = String(status.count);
          STATE.likes.set(newPost, status);
        });
      }
    });
  }
}

function renderThreadList(listEl) {
  listEl.innerHTML = "";
  messageData.forEach((thread) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <button type="button" class="thread" data-thread="${thread.id}">
        <div>
          <h3>${thread.title}</h3>
          <p>${thread.meta}</p>
        </div>
        <span aria-hidden="true">›</span>
      </button>
    `;
    const button = item.querySelector(".thread");
    if (STATE.conversations.active?.id === thread.id) {
      button?.classList.add("thread--active");
    }
    listEl.appendChild(item);
  });
}

function renderConversation(thread, revealNames) {
  const messageThread = document.getElementById("message-thread");
  const roomTitle = document.getElementById("room-title");
  const roomMeta = document.getElementById("room-meta");
  const toggleAnon = document.getElementById("toggle-anon");
  const form = document.getElementById("message-form");

  if (!messageThread || !roomTitle || !roomMeta || !toggleAnon || !form) {
    return;
  }

  roomTitle.textContent = thread.title;
  roomMeta.textContent = thread.meta;
  messageThread.innerHTML = "";

  thread.messages.forEach((message) => {
    const li = document.createElement("li");
    li.className = "message";
    li.innerHTML = `
      <span class="message__author">${revealNames ? message.author : maskAuthor(message.author, thread.anonymous)}</span>
      <p>${message.text}</p>
      <time>${message.time}</time>
    `;
    messageThread.appendChild(li);
  });

  toggleAnon.hidden = !thread.anonymous;
  toggleAnon.dataset.threadId = thread.id;
  toggleAnon.textContent = revealNames ? "Hide names" : "Reveal names";
  form.hidden = false;
  form.dataset.threadId = thread.id;
}

function maskAuthor(author, anonymous) {
  if (!anonymous || author === "You") {
    return author;
  }
  return "Anonymous";
}

function initMessages() {
  const listEl = document.getElementById("thread-list");
  const toggleAnon = document.getElementById("toggle-anon");
  const form = document.getElementById("message-form");
  const input = document.getElementById("message-input");

  if (!listEl || !form || !input) {
    return;
  }

  renderThreadList(listEl);

  listEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-thread]");
    if (!button) return;

    listEl.querySelectorAll(".thread").forEach((threadButton) => {
      threadButton.classList.toggle("thread--active", threadButton === button);
    });

    const thread = messageData.find((item) => item.id === button.dataset.thread);
    if (!thread) return;

    STATE.conversations.active = {
      id: thread.id,
      reveal: false,
    };
    renderConversation(thread, false);
  });

  toggleAnon?.addEventListener("click", () => {
    if (!STATE.conversations.active) return;
    const thread = messageData.find((item) => item.id === STATE.conversations.active.id);
    if (!thread) return;

    STATE.conversations.active.reveal = !STATE.conversations.active.reveal;
    renderConversation(thread, STATE.conversations.active.reveal);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!STATE.conversations.active) return;

    const thread = messageData.find((item) => item.id === STATE.conversations.active.id);
    if (!thread) return;

    const value = input.value.trim();
    if (!value) return;

    const newMessage = {
      author: "You",
      text: value,
      time: "Just now",
    };

    thread.messages.push(newMessage);
    renderConversation(thread, STATE.conversations.active.reveal);
    input.value = "";
    input.focus();
  });
}

function initProfile() {
  const highlightButton = document.querySelector('[data-action="add-highlight"]');
  const highlightList = document.getElementById("highlight-list");
  const editButton = document.querySelector('[data-action="edit-profile"]');
  const filterButton = document.querySelector('[data-action="filter-activity"]');

  highlightButton?.addEventListener("click", () => {
    const value = window.prompt("What highlight should we add?");
    if (!value || !highlightList) return;

    const li = document.createElement("li");
    li.innerHTML = `
      <h3>New highlight</h3>
      <p>${value}</p>
      <span>Boosted by you</span>
    `;
    highlightList.prepend(li);
  });

  editButton?.addEventListener("click", () => {
    window.alert("Profile editing coming soon.");
  });

  filterButton?.addEventListener("click", () => {
    window.alert("Filter options will let you drill into boosts, events, and more.");
  });
}

function init() {
  const page = document.body.dataset.page;

  switch (page) {
    case "landing":
      initLanding();
      break;
    case "signup":
      initSignup();
      break;
    case "feed":
      initFeed();
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
