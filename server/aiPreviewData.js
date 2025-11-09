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
  ageRange: "25-29",
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
    ageRange: "25-29",
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
    ageRange: "30-34",
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
    ageRange: "21-24",
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
    ageRange: "25-29",
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
    participants: [
      {
        username: "skylar00401",
        displayName: "Skylar Rivers",
        nickname: "Sky",
        avatar: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=160&q=80",
      },
      {
        username: AI_PREVIEW_USER.username,
        displayName: AI_PREVIEW_USER.fullName,
        nickname: "You",
        avatar: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=64&q=40",
      },
    ],
    theme: {
      id: "sunset-glow",
      name: "Sunset glow",
      background: "linear-gradient(135deg, #f9d976 0%, #f39f86 100%)",
      outgoingBubble: "#242021",
      incomingBubble: "rgba(255,255,255,0.85)",
    },
    lastMessage: {
      sender: "skylar00401",
      text: "Let's plan our coffee walk after your preview!",
      createdAt: minutesAgo(referenceDate, 5),
      readBy: [
        { username: AI_PREVIEW_USER.username, readAt: minutesAgo(referenceDate, 4) },
      ],
      reactions: [
        { emoji: "☕️", count: 2, reactors: [AI_PREVIEW_USER.username, "skylar00401"] },
      ],
    },
    updatedAt: minutesAgo(referenceDate, 5),
    unreadCount: 0,
    totalMessages: 4,
  },
  {
    username: "supper-club",
    fullName: "Saturday Supper Club",
    displayName: "Saturday Supper Club",
    tagline: "Friends who cook, eat, and hype each other up",
    badges: [],
    inbound: PEOPLE[1].inbound,
    outbound: PEOPLE[1].outbound,
    participants: [
      {
        username: "am1rpatty",
        displayName: "Amir Patel",
        avatar: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=160&q=80",
      },
      {
        username: "lucia-hsu",
        displayName: "Lucia Hsu",
        nickname: "DJ Spice",
        avatar: "https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?auto=format&fit=crop&w=160&q=80",
      },
      {
        username: AI_PREVIEW_USER.username,
        displayName: AI_PREVIEW_USER.fullName,
        avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=160&q=80",
      },
    ],
    theme: {
      id: "midnight",
      name: "Midnight neon",
      background: "linear-gradient(135deg, #10002b 0%, #240046 35%, #3c096c 100%)",
      outgoingBubble: "rgba(255,255,255,0.1)",
      incomingBubble: "rgba(16,0,43,0.72)",
    },
    lastMessage: {
      sender: "am1rpatty",
      text: "Your dosa night invite sounds incredible!",
      createdAt: minutesAgo(referenceDate, 42),
      attachments: [
        {
          type: "gif",
          url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExd3VxOWl1ZG5zOWJqam1vaGJkYzQzb2xyY2VhdWN0MWl4NmI0Y3ltMCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3ohs4BSacFKI7A717u/giphy.gif",
          originalName: "friends-cheers.gif",
        },
      ],
      reactions: [
        { emoji: "🔥", count: 3, reactors: ["lucia-hsu", "am1rpatty", AI_PREVIEW_USER.username] },
      ],
    },
    updatedAt: minutesAgo(referenceDate, 42),
    unreadCount: 0,
    totalMessages: 6,
  },
  {
    username: "jordan733",
    fullName: "Jordan Lee",
    displayName: "Anonymous admirer",
    tagline: "Startup operator exploring the arts",
    badges: ["Verified"],
    inbound: PEOPLE[2].inbound,
    outbound: PEOPLE[2].outbound,
    participants: [
      {
        username: "jordan733",
        displayName: "Anonymous admirer",
        anonymous: true,
      },
      {
        username: AI_PREVIEW_USER.username,
        displayName: AI_PREVIEW_USER.fullName,
      },
    ],
    theme: {
      id: "aurora",
      name: "Aurora",
      background: "linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)",
      outgoingBubble: "rgba(255,255,255,0.9)",
      incomingBubble: "rgba(0,0,0,0.55)",
    },
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
      participants: [
        {
          username: "skylar00401",
          displayName: "Skylar Rivers",
          nickname: "Sky",
          avatar: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=160&q=80",
        },
        {
          username: AI_PREVIEW_USER.username,
          displayName: AI_PREVIEW_USER.fullName,
          nickname: "You",
        },
      ],
      nicknames: {
        skylar00401: "Sky",
      },
      theme: {
        id: "sunset-glow",
        name: "Sunset glow",
        background: "linear-gradient(135deg, #f9d976 0%, #f39f86 100%)",
        outgoingBubble: "#242021",
        incomingBubble: "rgba(255,255,255,0.85)",
      },
      messageTheme: {
        id: "glow",
        name: "Luminous",
      },
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
          reactions: [
            { emoji: "💛", count: 1, reactors: [AI_PREVIEW_USER.username] },
          ],
        },
        {
          id: "m-skylar-2",
          sender: "ai-preview",
          text: "Happy to have you walk people through the experience.",
          createdAt: minutesAgo(referenceDate, 50),
          readBy: [
            { username: "skylar00401", readAt: minutesAgo(referenceDate, 48) },
          ],
        },
        {
          id: "m-skylar-3",
          sender: "skylar00401",
          text: "Let's plan our coffee walk after your preview!",
          createdAt: minutesAgo(referenceDate, 5),
          readBy: [
            { username: AI_PREVIEW_USER.username, readAt: minutesAgo(referenceDate, 4) },
          ],
          reactions: [
            { emoji: "☕️", count: 2, reactors: [AI_PREVIEW_USER.username, "skylar00401"] },
          ],
        },
        {
          id: "m-skylar-4",
          sender: "ai-preview",
          text: "Dropped a latte inspo board—tap for the mood!",
          createdAt: minutesAgo(referenceDate, 3),
          replyTo: "m-skylar-1",
          attachments: [
            {
              type: "image",
              url: "https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=900&q=80",
              originalName: "latte-art.jpg",
            },
            {
              type: "image",
              url: "https://images.unsplash.com/photo-1527169402691-feff5539e52c?auto=format&fit=crop&w=900&q=80",
              originalName: "coffee-shop.jpg",
            },
          ],
          readBy: [
            { username: "skylar00401", readAt: minutesAgo(referenceDate, 1) },
          ],
          reactions: [
            { emoji: "👏", count: 1, reactors: ["skylar00401"] },
          ],
        },
      ],
      totalMessages: 4,
      unreadCount: 0,
      updatedAt: minutesAgo(referenceDate, 5),
    },
  ],
  [
    "supper-club",
    {
      username: "supper-club",
      fullName: "Saturday Supper Club",
      displayName: "Saturday Supper Club",
      tagline: "Friends who cook, eat, and hype each other up",
      badges: [],
      participants: [
        {
          username: "am1rpatty",
          displayName: "Amir Patel",
          avatar: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=160&q=80",
        },
        {
          username: "lucia-hsu",
          displayName: "Lucia Hsu",
          nickname: "DJ Spice",
          avatar: "https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?auto=format&fit=crop&w=160&q=80",
        },
        {
          username: AI_PREVIEW_USER.username,
          displayName: AI_PREVIEW_USER.fullName,
          avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=160&q=80",
        },
      ],
      nicknames: {
        "lucia-hsu": "DJ Spice",
      },
      theme: {
        id: "midnight",
        name: "Midnight neon",
        background: "linear-gradient(135deg, #10002b 0%, #240046 35%, #3c096c 100%)",
        outgoingBubble: "rgba(255,255,255,0.1)",
        incomingBubble: "rgba(16,0,43,0.72)",
      },
      messageTheme: {
        id: "vibrant",
        name: "Vibrant",
      },
      inbound: clone(PEOPLE[1].inbound),
      outbound: clone(PEOPLE[1].outbound),
      hasMore: false,
      previousCursor: null,
      messages: [
        {
          id: "m-supper-1",
          sender: "ai-preview",
          text: "Your dosa night invite sounds incredible!",
          createdAt: minutesAgo(referenceDate, 42),
          attachments: [
            {
              type: "gif",
              url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExd3VxOWl1ZG5zOWJqam1vaGJkYzQzb2xyY2VhdWN0MWl4NmI0Y3ltMCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3ohs4BSacFKI7A717u/giphy.gif",
              originalName: "friends-cheers.gif",
            },
          ],
          reactions: [
            { emoji: "🔥", count: 3, reactors: ["lucia-hsu", "am1rpatty", AI_PREVIEW_USER.username] },
          ],
        },
        {
          id: "m-supper-2",
          sender: "lucia-hsu",
          text: "Theme suggestion: tropical disco. I'll cue the playlist!",
          createdAt: minutesAgo(referenceDate, 36),
          reactions: [
            { emoji: "🎶", count: 1, reactors: ["am1rpatty"] },
          ],
        },
        {
          id: "m-supper-3",
          sender: "am1rpatty",
          text: "Can someone drop the grocery inspo again?",
          createdAt: minutesAgo(referenceDate, 28),
        },
        {
          id: "m-supper-4",
          sender: AI_PREVIEW_USER.username,
          text: "Uploading the shared album—peep the video for plating inspo!",
          createdAt: minutesAgo(referenceDate, 20),
          attachments: [
            {
              type: "video",
              url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
              originalName: "plating.mp4",
            },
            {
              type: "image",
              url: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=80",
              originalName: "tapas-board.jpg",
            },
          ],
          replyTo: "m-supper-3",
          readBy: [
            { username: "am1rpatty", readAt: minutesAgo(referenceDate, 15) },
            { username: "lucia-hsu", readAt: minutesAgo(referenceDate, 14) },
          ],
        },
        {
          id: "m-supper-5",
          sender: "am1rpatty",
          text: "Seen! Adding these to the menu board now.",
          createdAt: minutesAgo(referenceDate, 10),
          readBy: [
            { username: AI_PREVIEW_USER.username, readAt: minutesAgo(referenceDate, 8) },
            { username: "lucia-hsu", readAt: minutesAgo(referenceDate, 7) },
          ],
          reactions: [
            { emoji: "👍", count: 1, reactors: [AI_PREVIEW_USER.username] },
          ],
        },
        {
          id: "m-supper-6",
          sender: "lucia-hsu",
          text: "Nicknaming you Chef Supreme for this spread.",
          createdAt: minutesAgo(referenceDate, 6),
          readBy: [
            { username: "am1rpatty", readAt: minutesAgo(referenceDate, 5) },
            { username: AI_PREVIEW_USER.username, readAt: minutesAgo(referenceDate, 4) },
          ],
          reactions: [
            { emoji: "😂", count: 1, reactors: ["am1rpatty"] },
          ],
        },
      ],
      totalMessages: 6,
      unreadCount: 0,
      updatedAt: minutesAgo(referenceDate, 6),
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
      participants: [
        {
          username: "jordan733",
          displayName: "Anonymous admirer",
          anonymous: true,
        },
        {
          username: AI_PREVIEW_USER.username,
          displayName: AI_PREVIEW_USER.fullName,
        },
      ],
      theme: {
        id: "aurora",
        name: "Aurora",
        background: "linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)",
        outgoingBubble: "rgba(255,255,255,0.9)",
        incomingBubble: "rgba(0,0,0,0.55)",
      },
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
          text: "Today I guided more users through WantYou!",
          attachments: [
            {
              type: "image",
              url: "https://images.unsplash.com/photo-1521336575822-6da63fb45455?auto=format&fit=crop&w=900&q=80",
              originalName: "team-celebration.jpg",
            },
          ],
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
          attachments: [
            {
              type: "image",
              url: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80",
              originalName: "preview-dashboard.png",
            },
          ],
          createdAt: minutesAgo(referenceDate, 240),
          visibility: "public",
          updatedAt: minutesAgo(referenceDate, 60),
          mood: "announcement",
        },
        {
          id: "post-preview-2",
          text: "Try filtering the lookup list or opening a thread to see what members can do.",
          attachments: [
            {
              type: "image",
              url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
              originalName: "coffee-meetup.jpg",
            },
            {
              type: "video",
              url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
              originalName: "tour-recap.mp4",
            },
          ],
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
        ageRange: "25-29",
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
        ageRange: "30-34",
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
        ageRange: "21-24",
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
        pronouns: "She/They",
        location: "Portland",
        relationshipStatus: "Not Looking",
        sexuality: "Demisexual",
        journey: "Always writing, sometimes sharing.",
        spotlight: "Forever chasing cozy cafes.",
        interests: ["Spoken word", "Tea rituals", "Trail walks"],
        links: [],
        ageRange: "25-29",
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
        ageRange: person.ageRange,
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
