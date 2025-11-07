# WantYou
WantYou app is a website.
You can login or create an account and look up other users by full name or username

You can mark people as:
* Know you
* Want you
* Both

You can chose to make a Want You anonymous and the user you marked that way can chat with you, get to know you, and ask you to reveal who you are by making your Want You public.

- "This user knows you"
- "This user wants you"
- "This user both knows and wants you"

All of the above are headers a conversation, be it anonymous or not, have.

You can chat with others without being anonymous.
## Log
* [11/06/2025; 5:01 PM] Repo creation
* [11/07/2025; 10:15 AM] Implemented WantYou landing experience with interactive discovery and messaging demo
* [11/07/2025; 1:11 AM UTC] Rebuilt WantYou as a multi-page social platform with an orange and white theme
* [11/07/2025; 3:25 PM UTC] Refocused WantYou on lookup statuses, anonymous reveals, and conversation headers
* [11/07/2025; 1:55 AM UTC] Added Vercel-compatible API handler and improved auth form autofill hints
* [11/08/2025; 2:45 PM UTC] Added Upstash-backed API with username/password auth and removed email flows
* [11/08/2025; 3:40 PM UTC] Removed dotenv dependency to rely on runtime environment variables
* [11/08/2025; 4:55 PM UTC] Finished dynamic lookup, messaging, and profile experiences with real user data flows
* [11/09/2025; 10:30 AM UTC] Added resilient chat storage fallback, anonymous nickname support, and privacy fixes for hidden Want Yous
* [11/07/2025; 2:57 AM UTC] Expanded profiles with media uploads, events, posts, and cross-profile viewing while hardening messaging fetches
* [11/09/2025; 5:45 PM UTC] Introduced WantYou and Verified badges with owner-managed verification controls across profiles and chats
* [11/10/2025; 3:20 PM UTC] Routed uploads to writable storage, kept verification controls owner-only in the UI, and aligned badges beside names
* [11/11/2025; 8:10 PM UTC] Persisted media uploads through KV streaming, restored avatar updates, added logout controls, and tightened the profile event highlight
* [11/12/2025; 4:30 PM UTC] Restored Vercel API routing, embedded media when persistent storage is unavailable, and refit the profile event highlight
* [11/07/2025; 5:24 AM UTC] Added persistent user IDs, username history management with edit limits, modernized page routing, and filtered conversations to active chats
* [11/07/2025; 6:45 AM UTC] Removed profile management controls from other users' pages to fully hide unauthorized actions
* [11/07/2025; 12:32 PM UTC] Corrected static asset paths so shared CSS and JS load on nested routes
* [11/13/2025; 11:05 AM UTC] Mapped server routing to nested lookup, messages, profile, and signup directories
* [11/13/2025; 2:55 PM UTC] Added Vercel rewrites so dynamic profile handles resolve to the profile experience
* [11/13/2025; 4:10 PM UTC] Preserved profile handle URLs by normalizing query-based profile loads to canonical @ paths
* [11/14/2025; 9:20 AM UTC] Expanded lookup with advanced filters, sorting controls, and a live status snapshot
* [11/14/2025; 1:45 PM UTC] Displayed real profile avatars in lookup and fixed all lookup filters to respect active criteria
* [11/15/2025; 9:55 AM UTC] Supercharged posts and events with visibility controls, moods, highlights, and an immersive event viewer
* [11/15/2025; 11:40 AM UTC] Polished event viewer accessibility with highlight cues and richer progress summaries
* [11/16/2025; 10:05 AM UTC] Supercharged messaging with unread tracking, search filtering, and scrolling chat history pagination
