# Community Platform — Firestore Database Structure

Target schema for `community.js` (Community Platform module). Replaces the
previous "one blob document per `CX.*` key" model, where every mutation —
one user liking one post — overwrote a single document holding the *entire*
array for that data type (all posts, all profiles, all forum threads, …),
clobbering concurrent writers. See `community.js`'s old header comment and
`firestore.rules`'s old "KNOWN LIMITATION" note for the problem this fixes.

## Principle

**One document per item**, not one document per data type. Mutations use
Firestore's atomic operators (`arrayUnion`, `arrayRemove`, `increment`,
dot-path field updates, `runTransaction`) so two different users writing to
the same document merge instead of one overwriting the other's write.

Two storage shapes are used, chosen per collection based on who writes to it:

- **Multi-writer collections** (posts, profiles, forum threads, funding
  requests, solutions, battles, follows, score history) — many different
  users can write to the *same* document (e.g. anyone can like anyone's
  post). These use atomic operators exclusively.
- **Single-writer collections** (notifications, bookmarks, streaks, daily
  challenge state, joined communities) — only the owning user ever writes
  their own document. These use plain `setDoc(..., { merge: true })` since
  there's no concurrent-writer race to guard against.

## Collections

| Collection | Doc ID | Shape | Writers |
|---|---|---|---|
| `cx_posts_v1` | `post.id` | `{ id, authorId, authorName, authorRole, authorAvatar, authorVerified, authorCompany, type, content, tags[], likes[], comments[], reactions:{uid:type}, views, timestamp }` | author (content) + any user (likes/comments/reactions/views only) |
| `cx_profiles_v1` | `uid` (= Firebase Auth UID) | `{ uid, fullName, email, role, bio, location, interests[], climateScore, followersCount, followingCount, postsCount, verified, avatar, company, website, portfolio[] }` | self (full edit) + any user (counter fields only, via `increment()`) |
| `cx_follows_v1` | `userId` (the follower) | `{ userId, following: string[] }` | self only |
| `cx_bookmarks_v1` | `userId` | `{ postIds: string[] }` | self only (private) |
| `cx_notifs_v1` | `userId` | `{ items: [{ id, type, fromId, fromName, postId, message, priority, read, timestamp }] }` (capped 50) | self only (private) — but *written on behalf of* the recipient by whichever user's action triggered it |
| `cx_forum_v1` | `thread.id` | `{ id, community, communityName, communityColor, title, body, tags[], authorId, authorName, authorAvatar, authorRole, upvotes, downvotes, replyCount, voters:{uid:'up'|'down'}, replies[], timestamp, pinned }` | author (content) + any user (voters/upvotes/downvotes/replies/replyCount only) |
| `cx_funding_user_v1` | `req.id` | `{ id, startupName, founderName, ..., interestedUsers[], savedByUsers[], expressedInterest, savedBy, timestamp }` | any signed-in user — see rules file for the ownership caveat |
| `cx_solutions_v1` | `sol.id` | `{ id, authorId, title, problem, solution, impact, industry, fundingRequired, tags[], upvotes[], bookmarks[], timestamp, verified }` | author (content) + any user (upvotes/bookmarks only) |
| `cx_battles_v1` | `battle.id` | `{ id, title, sideA, sideB, criteria[], votes:{sideA:{uid:true}, sideB:{uid:true}}, totalA, totalB, status, authorId, timestamp }` | author (content) + any user (votes/totalA/totalB only) |
| `cx_scores_v2` | `userId` | `{ userId, entries: [{ timestamp, delta, reason, scoreBefore, scoreAfter }] }` (capped 100) | written on behalf of the scored user by whichever action awarded points; readable by all (leaderboard needs cross-user aggregation) |
| `cx_streaks_v1` | `userId` | `{ current, longest, lastDay }` | self only |
| `cx_challenges_v2` | `${userId}_${YYYY-MM-DD}` | `{ date, userId, challenges[], allCompleted, bonusAwarded }` | self only |
| `cx_joined_v1` | `userId` | `{ communityIds: string[] }` | self only |

## Read pattern (unchanged public API)

Every exported function in `community.js` (`getPosts()`, `toggleLike()`, …)
stays **synchronous** — no HTML page needed to change. This works via a
live in-memory cache:

- "Multi-writer" collections subscribe once to the *whole* collection
  (`onSnapshot(collection(db, name))`), keeping a live-ordered array in
  memory. `getPosts()` etc. just reads that array.
- "Single-writer" collections subscribe per-document on first access
  (`onSnapshot(doc(db, name, id))`), scoped to whichever user is being
  read.

Before the first Firestore snapshot arrives, reads return the same
seed/fallback data used before the migration; a `cx:data-changed` event
fires once real data lands, and every consuming page already listens for
it (this pattern pre-dates this migration and was verified across all 7
community pages).

## Seeding — do NOT seed from the client

The old model let any visiting browser write demo/seed data straight into
Firestore if a collection was empty. That's incompatible with the new
owner-only `create` rules below (a random visitor isn't the `authorId` of
`seed_priya`'s posts), and isn't good practice regardless — demo data
belongs in a controlled admin step, not a client-writable code path.

Run `node scripts/seed-firestore.js` once (with a service account key) to
populate `cx_posts_v1`, `cx_profiles_v1`, `cx_forum_v1`,
`cx_funding_user_v1`, `cx_solutions_v1`, `cx_battles_v1` from the same
`SEED_*` constants `community.js` already ships with. See that script's
header for setup steps. Until it's run, the app will show the local seed
data as a placeholder (matching prior behavior) but writes against
not-yet-seeded items will fail until the real documents exist.

## Known limitation carried over

`cx_funding_user_v1` has no ownership check on `create`/`update` beyond
"signed in" — `funding-hub.html`'s submission form never records a
`founderId`, only a display name, so there's nothing to check equality
against. See the matching comment in `firestore.rules`.
