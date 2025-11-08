function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function minutesAgo(base, minutes) {
  return new Date(base.getTime() - minutes * 60 * 1000).toISOString();
}

const referenceDate = new Date("2025-01-15T18:30:00.000Z");

const AI_PREVIEW_USER = {
  fullName: "WantYou Tour Guide",
  username: "ai-preview",
  tagline: "Read-only walk-through for AI visitors",
  bio: "Explore WantYou in a safe, read-only session built for AI browsing.",
  profilePicturePath: "",
  badges: ["Verified"],
  userId: "tour-user-001",
  usernameHistory: [],
  usernameChangedAt: null,
  pronouns: "They/Them",
  location: "Everywhere",
  relationshipStatus: "Single",
  sexuality: "Pansexual",
  journey: "Curious connector",
  spotlight: "Helping you preview WantYou without logging in.",
  interests: ["Intentional dating", "Community", "Storytelling"],
  links: [
    { label: "About WantYou", url: "https://wantyou.vercel.app" },
    { label: "Press kit", url: "https://wantyou.vercel.app/press/" },
  ],
};

const PEOPLE = [
  {
    username: "skylar00401",
    fullName: "Skylar Rivers",
    tagline: "Product designer, loves morning coffee",
    badges: ["Verified"],
    userId: "user-skylar",
    profilePicture: "",
    previousUsernames: ["skyr"],
    inbound: {
      status: "both",
      anonymous: false,
      alias: "",
      updatedAt: minutesAgo(referenceDate, 12),
    },
    outbound: {
      status: "both",
      anonymous: false,
      alias: "",
      updatedAt: minutesAgo(referenceDate, 12),
    },
  },
  {
    username: "am1rpatty",
    fullName: "Amir Patel",
    tagline: "Community builder & weekend chef",
    badges: [],
    userId: "user-amir",
    profilePicture: "",
    previousUsernames: [],
    inbound: {
      status: "want",
      anonymous: false,
      alias: "",
      updatedAt: minutesAgo(referenceDate, 34),
    },
    outbound: {
      status: "know",
      anonymous: false,
      alias: "",
      updatedAt: minutesAgo(referenceDate, 90),
    },
  },
  {
    username: "jordan733",
    fullName: "Jordan Lee",
    tagline: "Startup operator exploring the arts",
    badges: ["Verified"],
    userId: "user-jordan",
    profilePicture: "",
    previousUsernames: [],
    inbound: {
      status: "know",
      anonymous: true,
      alias: "Sunbeam",
      updatedAt: minutesAgo(referenceDate, 210),
    },
    outbound: {
      status: "want",
      anonymous: true,
      alias: "Trailblazer",
      updatedAt: minutesAgo(referenceDate, 205),
    },
  },
  {
    username: "harper",
    fullName: "Harper Chen",
    tagline: "Writer documenting big feelings",
    badges: [],
    userId: "user-harper",
    profilePicture: "",
    previousUsernames: [],
    inbound: {
      status: "none",
      anonymous: false,
      alias: "",
      updatedAt: null,
    },
    outbound: {
      status: "none",
      anonymous: false,
      alias: "",
      updatedAt: null,
    },
  },
];

const THREAD_SUMMARIES = [
  {
    username: "skylar00401",
    fullName: "Skylar Rivers",
    displayName: "Skylar Rivers",
    tagline: "Product designer, loves morning coffee",
    badges: ["Verified"],
    inbound: PEOPLE[0].inbound,
    outbound: PEOPLE[0].outbound,
    lastMessage: {
      sender: "skylar",
      text: "Let's plan our coffee walk after your preview!",
      createdAt: minutesAgo(referenceDate, 5),
    },
    updatedAt: minutesAgo(referenceDate, 5),
    unreadCount: 0,
    totalMessages: 4,
  },
  {
    username: "am1rpatty",
    fullName: "Amir Patel",
    displayName: "Amir Patel",
    tagline: "Community builder & weekend chef",
    badges: [],
    inbound: PEOPLE[1].inbound,
    outbound: PEOPLE[1].outbound,
    lastMessage: {
      sender: "ai-preview",
      text: "Your dosa night invite sounds incredible!",
      createdAt: minutesAgo(referenceDate, 42),
    },
    updatedAt: minutesAgo(referenceDate, 42),
    unreadCount: 0,
    totalMessages: 3,
  },
  {
    username: "jordan733",
    fullName: "Jordan Lee",
    displayName: "Anonymous admirer",
    tagline: "Startup operator exploring the arts",
    badges: ["Verified"],
    inbound: PEOPLE[2].inbound,
    outbound: PEOPLE[2].outbound,
    lastMessage: null,
    updatedAt: minutesAgo(referenceDate, 205),
    unreadCount: 0,
    totalMessages: 0,
  },
];

const THREAD_DETAILS = new Map([
  [
    "skylar00401",
    {
      username: "skylar00401",
      fullName: "Skylar Rivers",
      displayName: "Skylar Rivers",
      tagline: "Product designer, loves morning coffee",
      badges: ["Verified"],
      inbound: clone(PEOPLE[0].inbound),
      outbound: clone(PEOPLE[0].outbound),
      hasMore: false,
      previousCursor: null,
      messages: [
        {
          id: "m-skylar-1",
          sender: "skylar00401",
          text: "Appreciate you checking the read-only tour!",
          createdAt: minutesAgo(referenceDate, 55),
        },
        {
          id: "m-skylar-2",
          sender: "ai-preview",
          text: "Happy to have you walk people through the experience.",
          createdAt: minutesAgo(referenceDate, 50),
        },
        {
          id: "m-skylar-3",
          sender: "skylar00401",
          text: "Let's plan our coffee walk after your preview!",
          createdAt: minutesAgo(referenceDate, 5),
        },
      ],
      totalMessages: 3,
      unreadCount: 0,
      updatedAt: minutesAgo(referenceDate, 5),
    },
  ],
  [
    "am1rpatty",
    {
      username: "am1rpatty",
      fullName: "Amir Patel",
      displayName: "Amir Patel",
      tagline: "Community builder & weekend chef",
      badges: [],
      inbound: clone(PEOPLE[1].inbound),
      outbound: clone(PEOPLE[1].outbound),
      hasMore: false,
      previousCursor: null,
      messages: [
        {
          id: "m-amir-1",
          sender: "ai-preview",
          text: "Your dosa night invite sounds incredible!",
          createdAt: minutesAgo(referenceDate, 42),
        },
        {
          id: "m-amir-2",
          sender: "am1rpatty",
          text: "I'll save you a plate once previews turn into parties.",
          createdAt: minutesAgo(referenceDate, 37),
        },
      ],
      totalMessages: 2,
      unreadCount: 0,
      updatedAt: minutesAgo(referenceDate, 42),
    },
  ],
  [
    "jordan733",
    {
      username: "jordan733",
      fullName: "Jordan Lee",
      displayName: "Anonymous admirer",
      tagline: "Startup operator exploring the arts",
      badges: ["Verified"],
      inbound: clone(PEOPLE[2].inbound),
      outbound: clone(PEOPLE[2].outbound),
      hasMore: false,
      previousCursor: null,
      messages: [],
      totalMessages: 0,
      unreadCount: 0,
      updatedAt: minutesAgo(referenceDate, 205),
    },
  ],
]);

const PROFILES = new Map([
  [
    "ai-preview",
    {
      user: AI_PREVIEW_USER,
      events: [
        {
          id: "event-preview-1",
          text: "Today I guided more users through WanYou!",
          attachments: [],
          createdAt: minutesAgo(referenceDate, 180),
          expiresAt: minutesAgo(referenceDate, -24 * 60),
          durationHours: 24,
          accent: "sunrise",
          highlighted: true,
        },
      ],
      posts: [
        {
          id: "post-preview-1",
          text: "In this tour you can browse connections, messages, and profiles—no login required.",
          attachments: [],
          createdAt: minutesAgo(referenceDate, 240),
          visibility: "public",
          updatedAt: minutesAgo(referenceDate, 60),
          mood: "announcement",
        },
        {
          id: "post-preview-2",
          text: "Try filtering the lookup list or opening a thread to see what members can do.",
          attachments: [],
          createdAt: minutesAgo(referenceDate, 200),
          visibility: "public",
          updatedAt: minutesAgo(referenceDate, 120),
          mood: "celebration",
        },
      ],
      canEdit: false,
      maxUploadSize: 100 * 1024 * 1024,
    },
  ],
  [
    "skylar00401",
    {
      user: {
        fullName: "Skylar Rivers",
        username: "skylar00401",
        tagline: "Product designer, loves morning coffee",
        bio: "Building welcoming spaces for intentional relationships.",
        profilePicturePath: "",
        badges: ["Verified"],
        userId: "user-skylar",
        usernameHistory: [
          { username: "skyr00401", changedAt: minutesAgo(referenceDate, 400) },
        ],
        pronouns: "She/Her",
        location: "Seattle",
        relationshipStatus: "Dating but Open",
        sexuality: "Straight",
        journey: "Designing new ways to say yes.",
        spotlight: "Always down for sunrise walks.",
        interests: ["Slow travel", "Latte art", "Community theater"],
        links: [
          { label: "Portfolio", url: "https://skylar.design" },
          { label: "Instagram", url: "https://instagram.com/skylar" },
        ],
      },
      events: [
        {
          id: "event-skylar-1",
          text: "Hosting sketch night downtown—DM if you want in!",
          attachments: [],
          createdAt: minutesAgo(referenceDate, 90),
          expiresAt: minutesAgo(referenceDate, -18 * 60),
          durationHours: 12,
          accent: "ocean",
          highlighted: false,
        },
      ],
      posts: [
        {
          id: "post-skylar-1",
          text: "Prototype jam went great—thanks for cheering us on!",
          attachments: [],
          createdAt: minutesAgo(referenceDate, 300),
          visibility: "public",
          updatedAt: minutesAgo(referenceDate, 180),
          mood: "celebration",
        },
      ],
      canEdit: false,
      maxUploadSize: 100 * 1024 * 1024,
    },
  ],
  [
    "am1rpatty",
    {
      user: {
        fullName: "Amir Patel",
        username: "am1rpatty",
        tagline: "Community builder & weekend chef",
        bio: "Hosting pop-up dinners with new friends.",
        profilePicturePath: "",
        badges: [],
        userId: "user-amir",
        usernameHistory: [],
        pronouns: "He/Him",
        location: "Chicago",
        relationshipStatus: "Single",
        sexuality: "Gay",
        journey: "Looking to share meals and meaningful chats.",
        spotlight: "Try my cardamom chai.",
        interests: ["Cooking", "Neighborhood hangs", "Indie film"],
        links: [
          { label: "Supper club", url: "https://amir.community" },
        ],
      },
      events: [],
      posts: [
        {
          id: "post-amir-1",
          text: "Planning dosa night this Saturday—message me if you're nearby!",
          attachments: [],
          createdAt: minutesAgo(referenceDate, 130),
          visibility: "public",
          updatedAt: minutesAgo(referenceDate, 110),
          mood: "announcement",
        },
      ],
      canEdit: false,
      maxUploadSize: 100 * 1024 * 1024,
    },
  ],
  [
    "jordan733",
    {
      user: {
        fullName: "Jordan Lee",
        username: "jordan733",
        tagline: "Startup operator exploring the arts",
        bio: "Currently curating pop-up galleries in the city.",
        profilePicturePath: "",
        badges: ["Verified"],
        userId: "user-jordan",
        usernameHistory: [],
        pronouns: "They/Them",
        location: "New York",
        relationshipStatus: "Dating but Open",
        sexuality: "Bisexual",
        journey: "Looking for co-conspirators in art adventures.",
        spotlight: "Ask me about immersive theater.",
        interests: ["Indie galleries", "Cycling", "Poetry"],
        links: [
          { label: "Latest installation", url: "https://jordanmakes.art" },
        ],
      },
      events: [
        {
          id: "event-jordan-1",
          text: "My back hurts...",
          attachments: [],
          createdAt: minutesAgo(referenceDate, 30),
          expiresAt: minutesAgo(referenceDate, -10 * 60),
          durationHours: 6,
          accent: "violet",
          highlighted: true,
        },
      ],
      posts: [],
      canEdit: false,
      maxUploadSize: 100 * 1024 * 1024,
    },
  ],
  [
    "harper",
    {
      user: {
        fullName: "Harper Chen",
        username: "harper",
        tagline: "Writer documenting big feelings",
        bio: "Collecting stories for my next zine.",
        profilePicturePath: "",
        badges: [],
        userId: "user-harper",
        usernameHistory: [],
        pronouns: "she/they",
        location: "Portland",
        relationshipStatus: "not-looking",
        sexuality: "Demisexual",
        journey: "Always writing, sometimes sharing.",
        spotlight: "Forever chasing cozy cafes.",
        interests: ["Spoken word", "Tea rituals", "Trail walks"],
        links: [],
      },
      events: [],
      posts: [],
      canEdit: false,
      maxUploadSize: 100 * 1024 * 1024,
    },
  ],
]);

function getAiUser() {
  return clone(AI_PREVIEW_USER);
}

function getSessionPayload() {
  return { user: getAiUser(), readOnly: true };
}

function getLookupPayload() {
  return { people: clone(PEOPLE) };
}

function getUsersPayload() {
  return {
    users: clone(
      PEOPLE.map((person) => ({
        username: person.username,
        fullName: person.fullName,
        tagline: person.tagline,
        badges: person.badges,
        userId: person.userId,
        profilePicturePath: "",
        previousUsernames: person.previousUsernames,
      }))
    ),
  };
}

function getThreadsPayload() {
  return {
    threads: clone(
      THREAD_SUMMARIES.map((thread) => ({
        ...thread,
        hasMore: false,
      }))
    ),
  };
}

function getThreadDetail(username) {
  const detail = THREAD_DETAILS.get(username);
  if (!detail) {
    return null;
  }
  return { thread: clone(detail) };
}

function getSelectedThreadPayload() {
  const detail = THREAD_DETAILS.get("skylar00401");
  if (!detail) {
    return { message: "No stored thread" };
  }
  return {
    thread: {
      threadId: "skylar-thread",
      person: detail.username,
      name: detail.displayName,
      status: detail.inbound.status,
      anonymous: detail.inbound.anonymous,
    },
  };
}

function getProfilePayload(username) {
  const key = username || AI_PREVIEW_USER.username;
  const record = PROFILES.get(key);
  if (!record) {
    return null;
  }
  const { user, events, posts, canEdit, maxUploadSize } = record;
  return {
    user: clone({ ...user }),
    events: clone(events),
    posts: clone(posts),
    canEdit,
    maxUploadSize,
  };
}

module.exports = {
  getAiUser,
  getSessionPayload,
  getLookupPayload,
  getUsersPayload,
  getThreadsPayload,
  getThreadDetail,
  getSelectedThreadPayload,
  getProfilePayload,
};
