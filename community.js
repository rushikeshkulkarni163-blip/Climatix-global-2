// ── Climactix Global · Community Platform ─────────────────────────────────
// Full persistence layer.
//
// LOCAL MODE  (firebase-config.js still has YOUR_* placeholders)
//   → every mutation writes to localStorage — single browser only, posts
//     never leave the device that created them.
//
// FIREBASE MODE  (real config pasted into firebase-config.js)
//   → every mutation writes to a Firestore document and every reader
//     subscribes to it in realtime, so posts/profiles/threads become
//     visible to every user, on every device, live.
//   → storage model: one Firestore doc per CX.* key (community_data/{key})
//     holding the whole array/object as a single `value` field — this
//     mirrors the flat-array shape all the functions below already assume,
//     so createPost/toggleLike/addComment/etc. did not need to change.
//   → known trade-off: writes replace the whole document, so two users
//     mutating the same key in the same instant can clobber each other
//     (last write wins). Fine at demo/early scale. If write volume grows,
//     migrate CX.POSTS to a Firestore subcollection (one doc per post)
//     with per-field updates instead of whole-array overwrites.

'use strict';

import { firebaseConfig } from './firebase-config.js';

const _USE_FIREBASE = !firebaseConfig.apiKey.startsWith('YOUR_');
const _FS_APP_URL       = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
const _FS_FIRESTORE_URL = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let _fsApiPromise = null;
function _firestore() {
  if (!_fsApiPromise) {
    _fsApiPromise = Promise.all([import(_FS_APP_URL), import(_FS_FIRESTORE_URL)])
      .then(([{ initializeApp, getApps }, fs]) => {
        const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        return { db: fs.getFirestore(app), ...fs };
      });
  }
  return _fsApiPromise;
}

// In-memory mirror so every existing exported function can keep reading
// synchronously via load(), same as it did against localStorage.
const _cache = Object.create(null);
const _subscribed = Object.create(null);

function _emit(key) {
  window.dispatchEvent(new CustomEvent('cx:data-changed', { detail: { key } }));
}

// Subscribe to be notified when any community data changes remotely
// (e.g. another user creates a post) so the UI can re-render live.
// Returns an unsubscribe function.
export function onCommunityDataChanged(handler) {
  const fn = (e) => handler(e.detail.key);
  window.addEventListener('cx:data-changed', fn);
  return () => window.removeEventListener('cx:data-changed', fn);
}

function _subscribe(key, fallback) {
  if (_subscribed[key]) return;
  _subscribed[key] = true;
  _firestore().then(({ db, doc, onSnapshot, setDoc }) => {
    const ref = doc(db, 'community_data', key);
    onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        _cache[key] = snap.data().value;
      } else {
        // Nothing on the server yet for this key — claim the seed/fallback
        // as canonical. Only fires when the doc truly doesn't exist, so
        // this never clobbers real data written by another client.
        _cache[key] = fallback;
        setDoc(ref, { value: fallback }).catch(err => console.error('[community] seed write failed', key, err));
      }
      _emit(key);
    }, (err) => console.error('[community] Firestore sync failed, staying on last known data', key, err));
  });
}

// ── Storage keys ───────────────────────────────────────────────────────────
export const CX = {
  POSTS:      'cx_posts_v1',
  PROFILES:   'cx_profiles_v1',
  FOLLOWS:    'cx_follows_v1',
  BOOKMARKS:  'cx_bookmarks_v1',
  FORUM:      'cx_forum_v1',
  NOTIFS:     'cx_notifs_v1',
  FUNDING:    'cx_funding_user_v1',
  INTERESTS:  'cx_interests_v1',
  // ── New engines ──
  SCORES:     'cx_scores_v2',       // Score history per user
  CHALLENGES: 'cx_challenges_v2',   // Daily challenge state
  REACTIONS:  'cx_reactions_v2',    // Post reactions (replaces plain likes)
  SOLUTIONS:  'cx_solutions_v1',    // Solution Hub entries
  PITCHES:    'cx_pitches_v1',      // VC Pitch Cards
  BATTLES:    'cx_battles_v1',      // Battle mode
  STREAKS:    'cx_streaks_v1',      // Daily streaks
};

// ── Role configuration ─────────────────────────────────────────────────────
export const ROLES = {
  individual:  { label: 'Individual',      color: '#374151', bg: '#F3F4F6' },
  startup:     { label: 'Climate Startup',  color: '#0B3D2E', bg: '#D1FAE5' },
  corporate:   { label: 'Corporate / ESG',  color: '#1D4ED8', bg: '#DBEAFE' },
  investor:    { label: 'Investor / VC',    color: '#92400E', bg: '#FEF3C7' },
  researcher:  { label: 'Researcher / NGO', color: '#5B21B6', bg: '#EDE9FE' },
};

export const AVATAR_COLORS = {
  individual:  '#4B5563',
  startup:     '#0B3D2E',
  corporate:   '#1D4ED8',
  investor:    '#92400E',
  researcher:  '#5B21B6',
};

// ── Climate Score config ───────────────────────────────────────────────────
export const SCORE_EVENTS = {
  POST_CREATED:       { delta: +2,  label: 'Post published',          icon: '📝' },
  VERIFIED_INITIATIVE:{ delta: +10, label: 'Verified initiative',      icon: '✓'  },
  REACTION_RECEIVED:  { delta: +1,  label: 'Engagement received',      icon: '🌱' },
  COMMENT_RECEIVED:   { delta: +1,  label: 'Comment on your post',     icon: '💬' },
  SOLUTION_CREATED:   { delta: +5,  label: 'Solution Hub entry',       icon: '💡' },
  CHALLENGE_COMPLETE: { delta: +5,  label: 'Daily challenge completed', icon: '🏆' },
  STREAK_BONUS:       { delta: +3,  label: 'Streak bonus',             icon: '🔥' },
  PITCH_VIEWED:       { delta: +1,  label: 'Pitch deck viewed',        icon: '👁' },
  SPAM_PENALTY:       { delta: -5,  label: 'Low-quality content flag', icon: '⚠️' },
  FOLLOW_RECEIVED:    { delta: +1,  label: 'New follower',             icon: '👤' },
};

// ── Reaction types ─────────────────────────────────────────────────────────
export const REACTION_TYPES = {
  impactful:     { emoji: '🌱', label: 'Impactful',     color: '#065F46' },
  innovative:    { emoji: '💡', label: 'Innovative',    color: '#B45309' },
  scalable:      { emoji: '📊', label: 'Scalable',      color: '#1D4ED8' },
  game_changing: { emoji: '🔥', label: 'Game-changing', color: '#DC2626' },
};

// ── Daily challenge definitions ────────────────────────────────────────────
export const CHALLENGE_DEFS = [
  { id: 'post_today',   label: 'Share a climate action',   desc: 'Publish at least one post today', icon: '📝', points: 5 },
  { id: 'engage_three', label: 'Engage with 3 posts',      desc: 'React or comment on 3 posts',     icon: '🌱', points: 3 },
  { id: 'upload_init',  label: 'Submit a solution',        desc: 'Add an entry to Solution Hub',    icon: '💡', points: 7 },
];

// ── Seed profiles ──────────────────────────────────────────────────────────
const SEED_PROFILES = [
  {
    uid: 'seed_priya', fullName: 'Priya Sharma', email: 'priya@greenfuture.in',
    role: 'startup', bio: 'Founder & CEO @ GreenFuture Energy · Solar micro-grids for rural India · Forbes 30U30 · UNDP Climate Champion · IIT Bombay',
    location: 'Mumbai, India', interests: ['Solar Energy', 'Rural Electrification', 'Impact Finance', 'Women in Climate'],
    climateScore: 87, followersCount: 1247, followingCount: 340, postsCount: 48,
    verified: true, avatar: 'PS', company: 'GreenFuture Energy', website: 'greenfuture.in',
    portfolio: [
      { name: 'Solar Micro-Grid Pilot – Maharashtra', impact: '12,000 homes powered' },
      { name: 'Women Energy Entrepreneurs Program', impact: '240 local jobs' },
    ],
  },
  {
    uid: 'seed_arjun', fullName: 'Arjun Kapoor', email: 'arjun@sequoiaclimate.com',
    role: 'investor', bio: 'Partner @ Sequoia Climate Fund · $2B+ deployed in climate tech · Board: 7 unicorns · Oxford MBA · Angel: 40+ climate startups',
    location: 'New Delhi, India', interests: ['Climate Finance', 'Deep Tech', 'Carbon Markets', 'Green Infrastructure'],
    climateScore: 91, followersCount: 8932, followingCount: 412, postsCount: 127,
    verified: true, avatar: 'AK', company: 'Sequoia Climate Fund', website: 'sequoiaclimate.com',
    portfolio: [
      { name: 'Series A: GreenFuture Energy', impact: '$6M · Solar' },
      { name: 'Series B: CarbonTrace AI', impact: '$12M · MRV' },
    ],
  },
  {
    uid: 'seed_meera', fullName: 'Dr. Meera Nair', email: 'meera@iitd.ac.in',
    role: 'researcher', bio: 'Climate Scientist @ IIT Delhi · IPCC AR6 Contributing Author · Carbon capture & enhanced weathering research · 120+ publications',
    location: 'New Delhi, India', interests: ['Carbon Capture', 'Climate Policy', 'IPCC Research', 'Enhanced Weathering'],
    climateScore: 94, followersCount: 3120, followingCount: 890, postsCount: 89,
    verified: true, avatar: 'MN', company: 'IIT Delhi', website: 'iitd.ac.in', portfolio: [],
  },
  {
    uid: 'seed_rahul', fullName: 'Rahul Menon', email: 'rahul.menon@tata.com',
    role: 'corporate', bio: 'Head of ESG Strategy @ Tata Group · Net Zero 2040 program lead · CSRD & ISSB compliance · GRI Certified Practitioner · Ex-McKinsey',
    location: 'Bangalore, India', interests: ['ESG Reporting', 'Net Zero Strategy', 'CSRD', 'Supply Chain Decarbonisation'],
    climateScore: 78, followersCount: 5601, followingCount: 220, postsCount: 203,
    verified: true, avatar: 'RM', company: 'Tata Group', portfolio: [],
  },
  {
    uid: 'seed_aisha', fullName: 'Aisha Patel', email: 'aisha@climateadvocate.in',
    role: 'individual', bio: 'Climate activist & sustainability consultant · Ex-WWF India · Youth delegate at COP28 · Building towards a just, net-zero future',
    location: 'Pune, India', interests: ['Climate Activism', 'Sustainability', 'Policy Advocacy', 'Climate Justice'],
    climateScore: 62, followersCount: 890, followingCount: 1240, postsCount: 34,
    verified: false, avatar: 'AP', company: '',
  },
  {
    uid: 'seed_dev', fullName: 'Dev Krishnan', email: 'dev@carbontrace.ai',
    role: 'startup', bio: 'Co-founder @ CarbonTrace AI · ML engineer turned climate entrepreneur · AI-powered MRV for voluntary carbon markets · Techstars \'24',
    location: 'Bangalore, India', interests: ['Carbon Markets', 'AI/ML', 'MRV Technology', 'Satellite Data'],
    climateScore: 79, followersCount: 642, followingCount: 480, postsCount: 22,
    verified: false, avatar: 'DK', company: 'CarbonTrace AI',
  },
];

// ── Seed posts ─────────────────────────────────────────────────────────────
const SEED_POSTS = [
  {
    id: 'p001', authorId: 'seed_priya', authorName: 'Priya Sharma', authorRole: 'startup',
    authorAvatar: 'PS', authorVerified: true, authorCompany: 'GreenFuture Energy', type: 'solution',
    content: `Thrilled to announce: GreenFuture Energy has deployed 500 solar micro-grids across rural Maharashtra — powering 12,000+ homes that previously had zero reliable electricity.\n\nOur model:\n→ Community-owned micro-grids (not just CSR)\n→ Pay-as-you-go solar (₹2/day per household)\n→ WhatsApp-based monitoring for local operators\n→ 100% women-led installation teams\n\nImpact so far:\n📊 18,000 tonnes CO₂ avoided annually\n💡 99.2% uptime vs 6hrs/day from grid\n👩‍🔧 240 local jobs created\n💰 $1.2M in household energy savings/year\n\nWe're raising Series A to scale to 5,000 villages. DM for pitch deck.`,
    tags: ['SolarEnergy', 'RuralElectrification', 'ClimateTech', 'ImpactInvesting', 'NetZero'],
    likes: ['seed_arjun', 'seed_meera', 'seed_rahul', 'seed_aisha', 'seed_dev'],
    comments: [
      { id: 'c001', authorId: 'seed_arjun', authorName: 'Arjun Kapoor', authorRole: 'investor', authorAvatar: 'AK',
        content: 'Incredible impact metrics, Priya! The pay-as-you-go model is exactly what scales in these markets. Would love to connect and discuss Series A details.', timestamp: Date.now() - 5400000, likes: ['seed_meera', 'seed_priya'] },
      { id: 'c002', authorId: 'seed_meera', authorName: 'Dr. Meera Nair', authorRole: 'researcher', authorAvatar: 'MN',
        content: '18,000 tCO₂e avoidance is significant at this scale. Would love to co-author a paper on methodology. Are you open to sharing operational data for our rural energy research at IIT Delhi?', timestamp: Date.now() - 2700000, likes: ['seed_priya'] },
    ],
    views: 4821, timestamp: Date.now() - 10800000,
  },
  {
    id: 'p002', authorId: 'seed_arjun', authorName: 'Arjun Kapoor', authorRole: 'investor',
    authorAvatar: 'AK', authorVerified: true, authorCompany: 'Sequoia Climate Fund', type: 'funding',
    content: `Sequoia Climate Fund is actively deploying capital in Q2 2025.\n\nWe're specifically looking for:\n\n🔋 Energy Storage: Novel chemistries, grid-scale solutions\n🌊 Blue Carbon: Mangrove/seagrass restoration with MRV\n🏗️ Green Construction: Embodied carbon reduction tech\n🚜 AgriTech Climate: Soil carbon, precision farming\n\nTicket size: $2M–$25M (Seed to Series B)\nGeography: India, SEA, MENA\nClimate Impact Score requirement: >70 on Climactix\n\nFounders: Tag your startup below or DM with 3-slide teaser.\nInvestors: Happy to co-invest on high-conviction deals.`,
    tags: ['ClimateVC', 'ImpactInvesting', 'GreenTech', 'SeriesA', 'ClimateFunding'],
    likes: ['seed_priya', 'seed_meera', 'seed_aisha', 'seed_dev'],
    comments: [
      { id: 'c003', authorId: 'seed_dev', authorName: 'Dev Krishnan', authorRole: 'startup', authorAvatar: 'DK',
        content: 'CarbonTrace AI checks a few of these boxes — AI-powered MRV for voluntary carbon markets. We just closed Techstars Climate. DM sent!', timestamp: Date.now() - 7200000, likes: ['seed_arjun'] },
    ],
    views: 9234, timestamp: Date.now() - 18000000,
  },
  {
    id: 'p003', authorId: 'seed_meera', authorName: 'Dr. Meera Nair', authorRole: 'researcher',
    authorAvatar: 'MN', authorVerified: true, authorCompany: 'IIT Delhi', type: 'research',
    content: `New research published: Enhanced weathering as a carbon removal pathway at gigaton scale.\n\nKey findings:\n• Basalt weathering can sequester 0.5–2.0 GtCO₂/year globally by 2050\n• Cost curve: $50–120/tonne (vs $300+ for DAC)\n• Co-benefit: 15–25% crop yield increase in alkaline-deficient soils\n• MRV methodology now validated across 3 Indian states\n\nFull paper: Nature Climate Change (link in first comment)\nDataset available for academic partners on request\n\nSeeking implementation partners — climate startups, state govts, CSR funds.`,
    tags: ['CarbonRemoval', 'EnhancedWeathering', 'ClimateScience', 'CarbonMarkets', 'IPCC'],
    likes: ['seed_arjun', 'seed_rahul', 'seed_priya'],
    comments: [],
    views: 6102, timestamp: Date.now() - 28800000,
  },
  {
    id: 'p004', authorId: 'seed_rahul', authorName: 'Rahul Menon', authorRole: 'corporate',
    authorAvatar: 'RM', authorVerified: true, authorCompany: 'Tata Group', type: 'update',
    content: `Hot take: Most corporate ESG reports are still theater.\n\nAfter reviewing 50+ reports this quarter, here's what separates leaders from laggards:\n\nLaggards:\n✗ Scope 3 completely ignored or cherry-picked\n✗ No third-party assurance\n✗ Targets without interim milestones\n\nLeaders:\n✓ Full Scope 1-2-3 disclosure with GHG Protocol methodology\n✓ ISSB IFRS S2 aligned — decision-useful for investors\n✓ Science-based targets with annual public tracking\n✓ CSRD-ready for EU market access\n✓ Board-level climate risk governance\n\nThe SEBI BRSR Core mandate is forcing Indian corporates to level up — and honestly, it's about time.\n\nWhere does your company stand? Be honest in the comments.`,
    tags: ['ESG', 'CSRDCompliance', 'SustainabilityReporting', 'ISSB', 'NetZero', 'SEBI'],
    likes: ['seed_meera', 'seed_aisha', 'seed_arjun'],
    comments: [],
    views: 12450, timestamp: Date.now() - 43200000,
  },
  {
    id: 'p005', authorId: 'seed_dev', authorName: 'Dev Krishnan', authorRole: 'startup',
    authorAvatar: 'DK', authorVerified: false, authorCompany: 'CarbonTrace AI', type: 'update',
    content: `We just shipped something that will change how voluntary carbon markets operate in India.\n\nCarbonTrace AI now integrates with:\n→ Sentinel-2 satellite imagery (10m resolution)\n→ IoT soil sensors (LoRaWAN network)\n→ Gold Standard API (direct credit issuance)\n\nResult: Carbon credit verification that used to take 18 months and cost $50K now takes 30 days and costs $2K.\n\nOpening beta to 20 project developers — priority for cookstove, REDD+, and soil carbon projects in India. Link in bio.`,
    tags: ['CarbonMarkets', 'MRV', 'AITech', 'VoluntaryCarbonMarket', 'ClimateStartup'],
    likes: ['seed_meera', 'seed_priya'],
    comments: [],
    views: 2341, timestamp: Date.now() - 64800000,
  },
];

// ── Seed forum threads ─────────────────────────────────────────────────────
const SEED_THREADS = [
  {
    id: 'f001', community: 'renewable-energy', communityName: 'Renewable Energy', communityColor: '#0B3D2E',
    title: 'Battery storage economics: Has the tipping point arrived for grid-scale storage in India?',
    body: 'BESS costs have dropped 89% since 2010. With recent SECI tenders showing Rs 2.4/kWh for 4-hour storage, are we finally at the inflection point where storage makes solar truly dispatchable without subsidies? Share data, models, or real-world project economics.',
    authorId: 'seed_priya', authorName: 'Priya Sharma', authorAvatar: 'PS', authorRole: 'startup',
    upvotes: 234, downvotes: 12, replyCount: 2, voters: { seed_arjun: 'up', seed_meera: 'up' },
    tags: ['BESS', 'GridStorage', 'SolarIndia', 'EnergyTransition'],
    replies: [
      { id: 'r001', authorId: 'seed_arjun', authorName: 'Arjun Kapoor', authorAvatar: 'AK', authorRole: 'investor',
        content: 'The SECI tender numbers are compelling but the real test is merchant risk. Most off-takers still want long-term PPAs which caps the arbitrage opportunity. That said, the $75/MWh target for BESS+solar co-location by 2026 looks achievable.', timestamp: Date.now() - 10800000, likes: ['seed_meera'] },
      { id: 'r002', authorId: 'seed_meera', authorName: 'Dr. Meera Nair', authorAvatar: 'MN', authorRole: 'researcher',
        content: 'Our modelling suggests grid-scale BESS reaches economic parity without subsidies when duration extends to 6 hours — we\'re seeing that threshold hit in Tamil Nadu first due to their renewable penetration levels. Happy to share the model.', timestamp: Date.now() - 7200000, likes: [] },
    ],
    timestamp: Date.now() - 14400000, pinned: true,
  },
  {
    id: 'f002', community: 'carbon-markets', communityName: 'Carbon Markets', communityColor: '#1D4ED8',
    title: 'Article 6 rulebook final: What it means for Indian carbon credit developers',
    body: 'COP29 finally delivered Article 6.4 rules. For project developers in India: ITMO registry now mandatory, additionality criteria tightened, host country authorization template published. Posting this thread for the community to share analysis and implications.',
    authorId: 'seed_meera', authorName: 'Dr. Meera Nair', authorAvatar: 'MN', authorRole: 'researcher',
    upvotes: 187, downvotes: 8, replyCount: 1, voters: { seed_rahul: 'up' },
    tags: ['Article6', 'CarbonMarkets', 'COP29', 'VCM', 'ITMO'],
    replies: [
      { id: 'r003', authorId: 'seed_dev', authorName: 'Dev Krishnan', authorAvatar: 'DK', authorRole: 'startup',
        content: 'From a developer perspective the new authorization template is actually cleaner than the old bilateral agreements. The 5% adaptation levy is the real pain point — effectively a 5% tax on all transactions that doesn\'t exist in voluntary markets.', timestamp: Date.now() - 18000000, likes: ['seed_meera'] },
    ],
    timestamp: Date.now() - 21600000, pinned: false,
  },
  {
    id: 'f003', community: 'esg-reporting', communityName: 'ESG Reporting', communityColor: '#92400E',
    title: 'BRSR Core vs GRI vs ISSB: Which framework should Indian mid-caps prioritize in 2025?',
    body: "Seeing a lot of confusion among mid-cap CFOs about which ESG framework to prioritize. SEBI mandates BRSR Core for top 1000 listed companies. But if you're eyeing EU markets, CSRD matters. And global investors want ISSB IFRS S2. Let's map this out.",
    authorId: 'seed_rahul', authorName: 'Rahul Menon', authorAvatar: 'RM', authorRole: 'corporate',
    upvotes: 312, downvotes: 4, replyCount: 0, voters: { seed_arjun: 'up', seed_meera: 'up', seed_aisha: 'up' },
    tags: ['BRSR', 'ISSB', 'GRI', 'ESGReporting', 'SEBI', 'CSRD'],
    replies: [],
    timestamp: Date.now() - 36000000, pinned: false,
  },
  {
    id: 'f004', community: 'climate-finance', communityName: 'Climate Finance', communityColor: '#5B21B6',
    title: 'Blended finance structures that actually work for early-stage climate startups — share real examples',
    body: "Most blended finance discussions stay theoretical. This thread is for practitioners only: share actual deal structures, DFI instruments, concessional tranches, and what made them bankable. First-loss capital, guarantees, green bonds — real examples please.",
    authorId: 'seed_arjun', authorName: 'Arjun Kapoor', authorAvatar: 'AK', authorRole: 'investor',
    upvotes: 156, downvotes: 3, replyCount: 0, voters: { seed_priya: 'up', seed_meera: 'up' },
    tags: ['BlendedFinance', 'ClimateFinance', 'DFI', 'GreenBonds'],
    replies: [],
    timestamp: Date.now() - 54000000, pinned: false,
  },
  {
    id: 'f005', community: 'nature-solutions', communityName: 'Nature-Based Solutions', communityColor: '#065F46',
    title: 'Mangrove carbon credits: MRV methodology gap is killing projects — what are the solutions?',
    body: "Blue carbon projects (mangroves, seagrass) sequester 3-5x more CO₂ per hectare than forests, but getting credits verified is a nightmare. The methodology gap between what satellites can see and what Verra/GS will accept is a real bottleneck. Who's solving this?",
    authorId: 'seed_dev', authorName: 'Dev Krishnan', authorAvatar: 'DK', authorRole: 'startup',
    upvotes: 98, downvotes: 5, replyCount: 0, voters: { seed_meera: 'up' },
    tags: ['BlueCarbon', 'MangroveRestoration', 'MRV', 'NaturalCapital'],
    replies: [],
    timestamp: Date.now() - 86400000, pinned: false,
  },
];

// ── Seed funding requests ──────────────────────────────────────────────────
export const SEED_FUNDING = [
  {
    id: 'fr001', startupName: 'GreenFuture Energy', founderName: 'Priya Sharma', founderAvatar: 'PS', founderRole: 'startup',
    stage: 'Series A', sector: 'Solar Energy', geography: 'India – Maharashtra, MP, UP',
    ask: '₹50 Cr ($6M)', valuationPre: '₹200 Cr', climateScore: 87, sdgAlignment: ['SDG 7', 'SDG 13', 'SDG 5'],
    problem: '300M rural Indians have no reliable electricity. Grid extension costs $2,000+ per connection and takes 5+ years.',
    solution: 'Community-owned solar micro-grids with pay-as-you-go model at $150/connection. WhatsApp-based O&M platform.',
    impact: '18,000 tCO₂e/year avoided · 12,000 homes powered · 240 women-led jobs · $1.2M household savings/year',
    traction: '500 villages · ₹2.1Cr ARR · 99.2% uptime · 94% retention · MNRE registered',
    useOfFunds: '60% – Scale to 5,000 villages, 3 states · 25% – 15 MW installed capacity · 15% – Working capital',
    tags: ['Solar', 'RuralElectrification', 'PayAsYouGo', 'SeriesA', 'WomenLed'],
    expressedInterest: 14, savedBy: 32, hasDeck: true, timestamp: Date.now() - 172800000,
    interestedUsers: ['seed_arjun'], savedByUsers: [],
    fundingReady: true, marketSize: '$4.2B', investorViews: 47,
  },
  {
    id: 'fr002', startupName: 'CarbonTrace AI', founderName: 'Dev Krishnan', founderAvatar: 'DK', founderRole: 'startup',
    stage: 'Seed', sector: 'Carbon Markets / AI', geography: 'India, Southeast Asia',
    ask: '$1.5M', valuationPre: '$8M', climateScore: 79, sdgAlignment: ['SDG 13', 'SDG 17'],
    problem: 'Carbon credit verification takes 18 months and costs $50K+, blocking 80% of small project developers.',
    solution: 'AI + satellite + IoT MRV platform. 30-day verification at $2K/project. Direct API with Gold Standard & Verra.',
    impact: 'Unlocking 500+ small projects · 2M tCO₂e/year newly verifiable · $40M in carbon credits democratized',
    traction: '12 pilot projects · 2 LOIs signed · Techstars Climate \'24 · $180K pre-seed closed',
    useOfFunds: '50% – Satellite API & model training · 30% – 3 country partnerships · 20% – Team',
    tags: ['CarbonMarkets', 'MRV', 'AI', 'Seed', 'SaaS'],
    expressedInterest: 8, savedBy: 19, hasDeck: true, timestamp: Date.now() - 259200000,
    interestedUsers: [], savedByUsers: [],
    fundingReady: false, marketSize: '$850M', investorViews: 23,
  },
  {
    id: 'fr003', startupName: 'RegenSoil Tech', founderName: 'Kavita Reddy', founderAvatar: 'KR', founderRole: 'startup',
    stage: 'Pre-Seed', sector: 'AgriTech / Soil Carbon', geography: 'India – Telangana, Karnataka',
    ask: '$500K', valuationPre: '$3M', climateScore: 71, sdgAlignment: ['SDG 2', 'SDG 13', 'SDG 15'],
    problem: 'Indian agriculture contributes 18% of GHG emissions. Soil degradation reduces yields by 30%.',
    solution: 'Precision soil carbon measurement + regenerative farming advisory via mobile app. Aggregates smallholder credits.',
    impact: '50 tCO₂e/farm/year sequestered · 20% yield increase · ₹8,000/acre additional income for farmers',
    traction: '200 farmers enrolled · 3 FPOs signed · NABARD grant ₹25L received · Pilot data published',
    useOfFunds: '40% – IoT sensor deployment · 35% – Carbon credit certification · 25% – Team & ops',
    tags: ['AgriTech', 'SoilCarbon', 'RegenerativeFarming', 'PreSeed', 'FPO'],
    expressedInterest: 5, savedBy: 11, hasDeck: false, timestamp: Date.now() - 432000000,
    interestedUsers: [], savedByUsers: [],
    fundingReady: false, marketSize: '$1.1B', investorViews: 12,
  },
  {
    id: 'fr004', startupName: 'BlueTide Marine', founderName: 'Aryan Shah', founderAvatar: 'AS', founderRole: 'startup',
    stage: 'Seed', sector: 'Blue Carbon / Ocean', geography: 'India – Sundarbans, Gujarat Coast',
    ask: '$2M', valuationPre: '$10M', climateScore: 83, sdgAlignment: ['SDG 14', 'SDG 13', 'SDG 1'],
    problem: 'India has 4,900 km of coastline with degraded mangroves sequestering 60% less CO₂ than healthy ecosystems.',
    solution: 'Drone-assisted mangrove restoration with satellite-validated MRV. Community-based model with fishing communities.',
    impact: '500 ha restored · 125,000 tCO₂e/year sequestered · 1,200 coastal livelihoods supported',
    traction: '50 ha pilot complete · Verra methodology submission in progress · State Forest Dept MoU signed',
    useOfFunds: '55% – Restoration ops 500 ha · 30% – MRV infrastructure · 15% – Community programs',
    tags: ['BlueCarbon', 'Mangroves', 'OceanResilience', 'Seed', 'NBS'],
    expressedInterest: 11, savedBy: 24, hasDeck: true, timestamp: Date.now() - 604800000,
    interestedUsers: [], savedByUsers: [],
    fundingReady: true, marketSize: '$2.3B', investorViews: 31,
  },
];

// ── Seed Solutions Hub ─────────────────────────────────────────────────────
const SEED_SOLUTIONS = [
  {
    id: 'sol001', authorId: 'seed_priya', authorName: 'Priya Sharma', authorAvatar: 'PS', authorRole: 'startup',
    title: 'Pay-as-you-go Solar Micro-grids for Rural India',
    problem: '300M rural Indians lack reliable electricity, with grid extension costing $2,000+ per connection.',
    solution: 'Community-owned solar micro-grids at $150/connection with WhatsApp-based O&M and PAYG model.',
    impact: '18,000 tCO₂e/year avoided · 12,000 homes powered · $1.2M household savings/year',
    industry: 'Energy Access', fundingRequired: '$6M Series A', collaborationOpen: true,
    upvotes: ['seed_arjun', 'seed_meera', 'seed_rahul'], bookmarks: ['seed_arjun'],
    tags: ['SolarEnergy', 'RuralElectrification', 'ImpactInvesting'],
    timestamp: Date.now() - 86400000, verified: true,
  },
  {
    id: 'sol002', authorId: 'seed_dev', authorName: 'Dev Krishnan', authorAvatar: 'DK', authorRole: 'startup',
    title: 'AI-Powered Carbon Credit Verification (30 Days, $2K)',
    problem: 'Carbon credit verification takes 18 months at $50K, blocking 80% of small project developers.',
    solution: 'Satellite + IoT + AI MRV platform integrating directly with Gold Standard and Verra APIs.',
    impact: '500+ projects unlocked · 2M tCO₂e/year newly verifiable · $40M in credits democratized',
    industry: 'Carbon Markets', fundingRequired: '$1.5M Seed', collaborationOpen: true,
    upvotes: ['seed_meera', 'seed_priya', 'seed_arjun'], bookmarks: ['seed_arjun', 'seed_rahul'],
    tags: ['CarbonMarkets', 'MRV', 'AI'],
    timestamp: Date.now() - 172800000, verified: false,
  },
  {
    id: 'sol003', authorId: 'seed_meera', authorName: 'Dr. Meera Nair', authorAvatar: 'MN', authorRole: 'researcher',
    title: 'Enhanced Weathering for Gigaton-Scale Carbon Removal',
    problem: 'Existing CDR pathways are too expensive ($300+/tonne for DAC) to reach gigatonne scale by 2050.',
    solution: 'Basalt application on agricultural land sequesters CO₂ at $50-120/tonne while boosting crop yields 15-25%.',
    impact: '0.5–2.0 GtCO₂/year globally by 2050 · $120/tonne max cost · 15-25% crop yield increase',
    industry: 'Carbon Removal', fundingRequired: 'Research Partners', collaborationOpen: true,
    upvotes: ['seed_arjun', 'seed_rahul', 'seed_priya', 'seed_dev'], bookmarks: ['seed_arjun'],
    tags: ['CarbonRemoval', 'EnhancedWeathering', 'IPCC'],
    timestamp: Date.now() - 259200000, verified: true,
  },
];

// ── Seed Battles ───────────────────────────────────────────────────────────
const SEED_BATTLES = [
  {
    id: 'bat001',
    title: 'Solar vs Wind: Best renewable for India 2030?',
    sideA: { label: 'Utility-Scale Solar', desc: 'Lowest LCOE at Rs 2.4/kWh, deployable in 18 months, 500GW potential', icon: '☀️' },
    sideB: { label: 'Offshore Wind',       desc: 'Higher capacity factor (40%+), 24/7 power, 70GW coastal potential', icon: '💨' },
    criteria: ['Impact', 'Innovation', 'Scalability'],
    votes: { sideA: { seed_priya: true, seed_dev: true }, sideB: { seed_arjun: true, seed_meera: true } },
    totalA: 2, totalB: 2, status: 'active',
    timestamp: Date.now() - 3600000,
  },
  {
    id: 'bat002',
    title: 'Carbon Credits vs Direct Green Investment: Which drives more impact?',
    sideA: { label: 'Voluntary Carbon Markets', desc: 'Mobilizes $1B+ annually, additionality debate ongoing, democratizes access', icon: '🌿' },
    sideB: { label: 'Direct Clean Investment',   desc: 'No additionality risk, builds assets, scales proven tech faster', icon: '⚡' },
    criteria: ['Impact', 'Innovation', 'Scalability'],
    votes: { sideA: { seed_meera: true }, sideB: { seed_rahul: true, seed_arjun: true, seed_priya: true } },
    totalA: 1, totalB: 3, status: 'active',
    timestamp: Date.now() - 7200000,
  },
];

// ── Communities ────────────────────────────────────────────────────────────
export const COMMUNITIES = [
  { id: 'renewable-energy',  name: 'Renewable Energy',        members: 12840, color: '#0B3D2E', icon: '⚡',
    desc: 'Deep dives into solar, wind, storage, green hydrogen, and the global energy transition.' },
  { id: 'carbon-markets',    name: 'Carbon Markets',           members: 8920,  color: '#1D4ED8', icon: '🌿',
    desc: 'VCM, CORSIA, Article 6, MRV, and carbon credit project development.' },
  { id: 'esg-reporting',     name: 'ESG Reporting',            members: 15320, color: '#92400E', icon: '📊',
    desc: 'ISSB, GRI, CSRD, BRSR, TCFD. ESG disclosure strategy, assurance, and investor relations.' },
  { id: 'climate-finance',   name: 'Climate Finance',          members: 9410,  color: '#5B21B6', icon: '💰',
    desc: 'Climate capital flows, blended finance, green bonds, DFI instruments, and impact investing.' },
  { id: 'nature-solutions',  name: 'Nature-Based Solutions',   members: 6730,  color: '#065F46', icon: '🌱',
    desc: 'NBS, biodiversity credits, mangroves, reforestation, soil carbon, and blue carbon.' },
  { id: 'green-mobility',    name: 'Green Mobility / EVs',     members: 11200, color: '#0369A1', icon: '🚗',
    desc: 'EV adoption, charging infrastructure, public transit electrification, and sustainable logistics.' },
  { id: 'circular-economy',  name: 'Circular Economy',         members: 5890,  color: '#B45309', icon: '♻️',
    desc: 'Waste reduction, product lifecycle thinking, industrial symbiosis, and circular business models.' },
  { id: 'climate-policy',    name: 'Climate Policy',           members: 7640,  color: '#9D174D', icon: '🏛️',
    desc: 'NDCs, carbon pricing, climate litigation, regulatory developments, and policy implementation.' },
];

// ── Utilities ──────────────────────────────────────────────────────────────
export function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7)  return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

export function getRoleConfig(role) {
  return ROLES[role] || ROLES.individual;
}

export function getInitials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

export function getAvatarColor(role) {
  return AVATAR_COLORS[role] || AVATAR_COLORS.individual;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Storage ────────────────────────────────────────────────────────────────
function load(key, fallback = null) {
  if (_USE_FIREBASE) {
    if (!(key in _cache)) { _cache[key] = fallback; _subscribe(key, fallback); }
    return _cache[key] ?? fallback;
  }
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, data) {
  _cache[key] = data;
  if (_USE_FIREBASE) {
    _subscribe(key, data);
    _firestore().then(({ db, doc, setDoc }) =>
      setDoc(doc(db, 'community_data', key), { value: data })
        .catch(err => console.error('[community] Firestore write failed', key, err))
    );
    _emit(key); // optimistic local notify so the writer's own UI updates instantly
    return;
  }
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

// ── Init (idempotent) ──────────────────────────────────────────────────────
export function initCommunity() {
  if (_USE_FIREBASE) {
    // Just prime the subscriptions early so data (or seed data, if the
    // Firestore doc doesn't exist yet) is ready before first render.
    load(CX.POSTS,     SEED_POSTS);
    load(CX.PROFILES,  SEED_PROFILES);
    load(CX.FORUM,     SEED_THREADS);
    load(CX.SOLUTIONS, SEED_SOLUTIONS);
    load(CX.BATTLES,   SEED_BATTLES);
    return;
  }
  if (!load(CX.POSTS))     save(CX.POSTS,     SEED_POSTS);
  if (!load(CX.PROFILES))  save(CX.PROFILES,  SEED_PROFILES);
  if (!load(CX.FORUM))     save(CX.FORUM,     SEED_THREADS);
  if (!load(CX.SOLUTIONS)) save(CX.SOLUTIONS, SEED_SOLUTIONS);
  if (!load(CX.BATTLES))   save(CX.BATTLES,   SEED_BATTLES);
}

// ── Auth ───────────────────────────────────────────────────────────────────
// Session is always device-local (managed by auth.js) — read straight from
// localStorage, never through the Firestore-synced load() above, otherwise
// one user's login session would leak into the shared community data.
export function getCurrentSession() {
  try { const v = localStorage.getItem('cx_session_v2'); return v ? JSON.parse(v) : null; } catch { return null; }
}

export function requireAuth(redirectTo = 'community-login.html') {
  const s = getCurrentSession();
  if (!s) { window.location.href = redirectTo + '?next=' + encodeURIComponent(window.location.pathname + window.location.search); return false; }
  return true;
}

export function isProfileComplete(profile) {
  return !!(profile && profile.role && profile.bio && profile.interests && profile.interests.length > 0);
}

// ── Profile CRUD ───────────────────────────────────────────────────────────
export function getProfiles() {
  return load(CX.PROFILES, SEED_PROFILES);
}

export function getProfile(uid) {
  return getProfiles().find(p => p.uid === uid || p.email === uid) || null;
}

export function getCurrentUserProfile() {
  const session = getCurrentSession();
  if (!session) return null;
  const profiles = getProfiles();
  const uid = session.uid || session.email;
  const existing = profiles.find(p => p.uid === uid || p.email === session.email);
  if (existing) return existing;

  const newProfile = {
    uid, fullName: session.fullName || 'Climate Professional',
    email: session.email || '', role: 'individual',
    bio: '', location: '', interests: [], climateScore: 0,
    followersCount: 0, followingCount: 0, postsCount: 0,
    verified: session.verified || false,
    avatar: getInitials(session.fullName || 'CP'),
    company: session.companyName || '',
    portfolio: [],
  };
  save(CX.PROFILES, [...profiles, newProfile]);
  return newProfile;
}

export function updateProfile(uid, updates) {
  const profiles = getProfiles();
  const idx = profiles.findIndex(p => p.uid === uid || p.email === uid);
  if (idx === -1) return false;
  profiles[idx] = { ...profiles[idx], ...updates };
  save(CX.PROFILES, profiles);
  return profiles[idx];
}

function _bumpProfile(uid, field, delta) {
  const profiles = getProfiles();
  const idx = profiles.findIndex(p => p.uid === uid || p.email === uid);
  if (idx > -1) {
    profiles[idx][field] = Math.max(0, (profiles[idx][field] || 0) + delta);
    save(CX.PROFILES, profiles);
  }
}

// ── Post CRUD ──────────────────────────────────────────────────────────────
export function getPosts() {
  return load(CX.POSTS, SEED_POSTS);
}

export function createPost({ authorId, authorName, authorRole, authorAvatar, authorVerified, authorCompany, type, content, tags }) {
  const posts = getPosts();
  const post = {
    id: 'p' + Date.now(), authorId, authorName,
    authorRole: authorRole || 'individual',
    authorAvatar: authorAvatar || getInitials(authorName),
    authorVerified: !!authorVerified,
    authorCompany: authorCompany || '',
    type: type || 'update',
    content: content.trim(), tags: tags || [],
    likes: [], comments: [], views: Math.floor(Math.random() * 40) + 5,
    timestamp: Date.now(),
  };
  save(CX.POSTS, [post, ...posts]);
  _bumpProfile(authorId, 'postsCount', 1);
  // Score event
  updateClimateScore(authorId, SCORE_EVENTS.POST_CREATED.delta, SCORE_EVENTS.POST_CREATED.label);
  // Challenge progress
  updateChallengeProgress(authorId, 'post_today');
  return post;
}

export function deletePost(postId, authorId) {
  const posts = getPosts().filter(p => !(p.id === postId && p.authorId === authorId));
  save(CX.POSTS, posts);
  _bumpProfile(authorId, 'postsCount', -1);
}

export function toggleLike(postId, userId) {
  const posts = getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return null;
  const idx = post.likes.indexOf(userId);
  const liked = idx === -1;
  if (liked) post.likes.push(userId);
  else post.likes.splice(idx, 1);
  save(CX.POSTS, posts);
  if (liked && post.authorId !== userId) {
    const byProfile = getProfile(userId);
    addNotification(post.authorId, {
      type: 'like', fromId: userId,
      fromName: byProfile?.fullName || 'Someone',
      postId, message: `liked your post`,
    });
  }
  return { count: post.likes.length, liked };
}

export function isLiked(postId, userId) {
  return getPosts().find(p => p.id === postId)?.likes.includes(userId) || false;
}

export function incrementPostViews(postId) {
  const posts = getPosts();
  const post = posts.find(p => p.id === postId);
  if (post) { post.views = (post.views || 0) + 1; save(CX.POSTS, posts); }
}

export function addComment(postId, { authorId, authorName, authorRole, authorAvatar, content }) {
  const posts = getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return null;
  const comment = {
    id: 'c' + Date.now(), authorId, authorName, authorRole,
    authorAvatar: authorAvatar || getInitials(authorName),
    content: content.trim(), timestamp: Date.now(), likes: [],
  };
  post.comments.push(comment);
  save(CX.POSTS, posts);
  if (post.authorId !== authorId) {
    const byProfile = getProfile(authorId);
    addNotification(post.authorId, {
      type: 'comment', fromId: authorId,
      fromName: byProfile?.fullName || 'Someone',
      postId, message: `commented on your post`,
      priority: 'normal',
    });
    // Score event for post author
    updateClimateScore(post.authorId, SCORE_EVENTS.COMMENT_RECEIVED.delta, SCORE_EVENTS.COMMENT_RECEIVED.label);
  }
  // Challenge progress for commenter
  updateChallengeProgress(authorId, 'engage_three');
  return comment;
}

export function toggleCommentLike(postId, commentId, userId) {
  const posts = getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return null;
  const comment = post.comments.find(c => c.id === commentId);
  if (!comment) return null;
  const idx = comment.likes.indexOf(userId);
  if (idx > -1) comment.likes.splice(idx, 1);
  else comment.likes.push(userId);
  save(CX.POSTS, posts);
  return comment.likes.length;
}

// ── Bookmarks ──────────────────────────────────────────────────────────────
export function toggleBookmark(postId, userId) {
  const bm = load(CX.BOOKMARKS, []);
  const key = `${userId}:${postId}`;
  const idx = bm.indexOf(key);
  if (idx > -1) bm.splice(idx, 1);
  else bm.push(key);
  save(CX.BOOKMARKS, bm);
  return idx === -1;
}

export function isBookmarked(postId, userId) {
  return load(CX.BOOKMARKS, []).includes(`${userId}:${postId}`);
}

export function getBookmarkedPosts(userId) {
  const bm = load(CX.BOOKMARKS, []);
  const ids = bm.filter(k => k.startsWith(userId + ':')).map(k => k.split(':')[1]);
  return getPosts().filter(p => ids.includes(p.id));
}

// ── Follows ────────────────────────────────────────────────────────────────
export function toggleFollow(targetId, currentUserId) {
  if (!targetId || !currentUserId || targetId === currentUserId) return null;
  const follows = load(CX.FOLLOWS, {});
  if (!follows[currentUserId]) follows[currentUserId] = [];
  const idx = follows[currentUserId].indexOf(targetId);
  const nowFollowing = idx === -1;
  if (nowFollowing) follows[currentUserId].push(targetId);
  else follows[currentUserId].splice(idx, 1);
  save(CX.FOLLOWS, follows);
  _bumpProfile(targetId,      'followersCount',  nowFollowing ? 1 : -1);
  _bumpProfile(currentUserId, 'followingCount',  nowFollowing ? 1 : -1);
  if (nowFollowing) {
    const by = getProfile(currentUserId);
    addNotification(targetId, {
      type: 'follow', fromId: currentUserId,
      fromName: by?.fullName || 'Someone', postId: null,
      message: 'started following you', priority: 'normal',
    });
    updateClimateScore(targetId, SCORE_EVENTS.FOLLOW_RECEIVED.delta, SCORE_EVENTS.FOLLOW_RECEIVED.label);
  }
  return nowFollowing;
}

export function isFollowing(targetId, currentUserId) {
  return (load(CX.FOLLOWS, {})[currentUserId] || []).includes(targetId);
}

export function getFollowers(uid) {
  const follows = load(CX.FOLLOWS, {});
  return Object.entries(follows)
    .filter(([, list]) => list.includes(uid))
    .map(([followerId]) => getProfile(followerId))
    .filter(Boolean);
}

export function getFollowingList(uid) {
  const ids = (load(CX.FOLLOWS, {})[uid] || []);
  return ids.map(id => getProfile(id)).filter(Boolean);
}

// ── Notifications (enhanced) ───────────────────────────────────────────────
export function addNotification(userId, { type, fromId, fromName, postId, message, priority = 'normal' }) {
  const notifs = load(CX.NOTIFS, {});
  if (!notifs[userId]) notifs[userId] = [];
  notifs[userId].unshift({
    id: 'n' + Date.now(), type, fromId, fromName, postId,
    message, priority, read: false, timestamp: Date.now(),
  });
  notifs[userId] = notifs[userId].slice(0, 50);
  save(CX.NOTIFS, notifs);
}

export function addSystemNotification(userId, { type, message, priority = 'important' }) {
  addNotification(userId, { type, fromId: 'system', fromName: 'Climactix', postId: null, message, priority });
}

export function getNotifications(userId) {
  return (load(CX.NOTIFS, {})[userId] || []);
}

export function getUnreadCount(userId) {
  return getNotifications(userId).filter(n => !n.read).length;
}

export function markNotifsRead(userId) {
  const notifs = load(CX.NOTIFS, {});
  (notifs[userId] || []).forEach(n => { n.read = true; });
  save(CX.NOTIFS, notifs);
}

// ── Forum CRUD ─────────────────────────────────────────────────────────────
export function getThreads(communityId = null) {
  const threads = load(CX.FORUM, SEED_THREADS);
  if (communityId) return threads.filter(t => t.community === communityId);
  return threads;
}

export function createThread({ community, communityName, communityColor, title, body, tags, authorId, authorName, authorAvatar, authorRole }) {
  const threads = load(CX.FORUM, SEED_THREADS);
  const thread = {
    id: 'f' + Date.now(), community, communityName, communityColor: communityColor || '#0B3D2E',
    title: title.trim(), body: (body || '').trim(), tags: tags || [],
    authorId, authorName, authorAvatar: authorAvatar || getInitials(authorName), authorRole,
    upvotes: 1, downvotes: 0, replyCount: 0,
    voters: { [authorId]: 'up' }, replies: [],
    timestamp: Date.now(), pinned: false,
  };
  save(CX.FORUM, [thread, ...threads]);
  return thread;
}

export function voteThread(threadId, userId, direction) {
  const threads = load(CX.FORUM, SEED_THREADS);
  const thread = threads.find(t => t.id === threadId);
  if (!thread) return null;
  if (!thread.voters) thread.voters = {};
  const prev = thread.voters[userId];
  if (prev === direction) {
    delete thread.voters[userId];
    if (direction === 'up') thread.upvotes = Math.max(0, thread.upvotes - 1);
    else thread.downvotes = Math.max(0, thread.downvotes - 1);
  } else {
    if (prev === 'up')   thread.upvotes   = Math.max(0, thread.upvotes - 1);
    if (prev === 'down') thread.downvotes = Math.max(0, thread.downvotes - 1);
    thread.voters[userId] = direction;
    if (direction === 'up')   thread.upvotes++;
    else thread.downvotes++;
  }
  save(CX.FORUM, threads);
  return { upvotes: thread.upvotes, downvotes: thread.downvotes, userVote: thread.voters[userId] || null };
}

export function addReply(threadId, { authorId, authorName, authorAvatar, authorRole, content }) {
  const threads = load(CX.FORUM, SEED_THREADS);
  const thread = threads.find(t => t.id === threadId);
  if (!thread) return null;
  if (!thread.replies) thread.replies = [];
  const reply = {
    id: 'r' + Date.now(), authorId, authorName,
    authorAvatar: authorAvatar || getInitials(authorName),
    authorRole, content: content.trim(), timestamp: Date.now(), likes: [],
  };
  thread.replies.push(reply);
  thread.replyCount = thread.replies.length;
  save(CX.FORUM, threads);
  return reply;
}

export function getThread(threadId) {
  return (load(CX.FORUM, SEED_THREADS)).find(t => t.id === threadId) || null;
}

// ── Funding CRUD ───────────────────────────────────────────────────────────
export function getAllFundingRequests() {
  const userCreated = load(CX.FUNDING, []);
  return [...userCreated, ...SEED_FUNDING];
}

export function createFundingRequest(data) {
  const existing = load(CX.FUNDING, []);
  const req = {
    id: 'fr' + Date.now(), ...data,
    expressedInterest: 0, savedBy: 0,
    interestedUsers: [], savedByUsers: [],
    fundingReady: false, investorViews: 0,
    timestamp: Date.now(),
  };
  save(CX.FUNDING, [req, ...existing]);
  return req;
}

export function toggleFundingInterest(fundingId, userId) {
  const userCreated = load(CX.FUNDING, []);
  const uc = userCreated.find(f => f.id === fundingId);
  if (uc) {
    if (!uc.interestedUsers) uc.interestedUsers = [];
    const idx = uc.interestedUsers.indexOf(userId);
    if (idx > -1) { uc.interestedUsers.splice(idx, 1); uc.expressedInterest--; }
    else { uc.interestedUsers.push(userId); uc.expressedInterest++; }
    save(CX.FUNDING, userCreated);
    return idx === -1;
  }
  const key = 'cx_fi_' + fundingId;
  const users = load(key, []);
  const idx = users.indexOf(userId);
  if (idx > -1) users.splice(idx, 1);
  else users.push(userId);
  save(key, users);
  return idx === -1;
}

export function isFundingInterested(fundingId, userId) {
  const uc = load(CX.FUNDING, []).find(f => f.id === fundingId);
  if (uc) return (uc.interestedUsers || []).includes(userId);
  return (load('cx_fi_' + fundingId, [])).includes(userId);
}

export function toggleFundingSave(fundingId, userId) {
  const key = 'cx_fs_' + fundingId;
  const users = load(key, []);
  const idx = users.indexOf(userId);
  if (idx > -1) users.splice(idx, 1);
  else users.push(userId);
  save(key, users);
  return idx === -1;
}

export function isFundingSaved(fundingId, userId) {
  return (load('cx_fs_' + fundingId, [])).includes(userId);
}

// ── Discovery ──────────────────────────────────────────────────────────────
export function getSuggestedProfiles(currentUserId, limit = 5) {
  const following = (load(CX.FOLLOWS, {})[currentUserId] || []);
  return getProfiles()
    .filter(p => p.uid !== currentUserId && !following.includes(p.uid))
    .sort((a, b) => b.followersCount - a.followersCount)
    .slice(0, limit);
}

export function getTrendingTags(limit = 8) {
  const counts = {};
  getPosts().forEach(p => (p.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag, count]) => ({ tag, count }));
}

export function getJoinedCommunities(userId) {
  return load('cx_joined_' + userId, []);
}

export function toggleJoinCommunity(communityId, userId) {
  const key = 'cx_joined_' + userId;
  const joined = load(key, []);
  const idx = joined.indexOf(communityId);
  if (idx > -1) joined.splice(idx, 1);
  else joined.push(communityId);
  save(key, joined);
  return idx === -1;
}

// ═══════════════════════════════════════════════════════════════════════════
// ── CLIMATE SCORE ENGINE ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export function updateClimateScore(userId, delta, reason) {
  // Update profile score (clamped 0–100)
  const profiles = getProfiles();
  const idx = profiles.findIndex(p => p.uid === userId || p.email === userId);
  if (idx === -1) return null;
  const prev = profiles[idx].climateScore || 0;
  const next = Math.min(100, Math.max(0, prev + delta));
  profiles[idx].climateScore = next;
  save(CX.PROFILES, profiles);

  // Append to score history
  const history = load(CX.SCORES, {});
  if (!history[userId]) history[userId] = [];
  history[userId].unshift({
    timestamp: Date.now(),
    delta,
    reason,
    scoreBefore: prev,
    scoreAfter: next,
  });
  history[userId] = history[userId].slice(0, 100);
  save(CX.SCORES, history);

  // Rank change notification
  const prevRank = getUserRank(userId);
  if (prevRank <= 10 && delta > 0) {
    addSystemNotification(userId, {
      type: 'rank_change',
      message: `You're in the Top ${prevRank} on the Climate Leaderboard 🔥`,
      priority: 'important',
    });
  }

  return { prev, next, delta };
}

export function getScoreHistory(userId) {
  return (load(CX.SCORES, {})[userId] || []);
}

export function getScoreBreakdown(userId) {
  const history = getScoreHistory(userId);
  const profile = getProfile(userId);
  if (!profile) return null;

  const grouped = {};
  history.forEach(h => {
    if (!grouped[h.reason]) grouped[h.reason] = { reason: h.reason, total: 0, count: 0 };
    grouped[h.reason].total += h.delta;
    grouped[h.reason].count++;
  });

  const scoringRules = Object.values(SCORE_EVENTS).map(e => ({
    label: e.label, delta: e.delta, icon: e.icon,
  }));

  return {
    currentScore: profile.climateScore || 0,
    history: history.slice(0, 10),
    grouped: Object.values(grouped).sort((a, b) => b.total - a.total),
    scoringRules,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ── LEADERBOARD ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export function getLeaderboard(filter = 'all-time', limit = 20) {
  const profiles = getProfiles();
  const now = Date.now();
  const cutoff = {
    'all-time': 0,
    'monthly':  now - 30 * 86400000,
    'weekly':   now - 7  * 86400000,
  }[filter] || 0;

  let ranked;
  if (filter === 'all-time') {
    ranked = profiles.map(p => ({ ...p, displayScore: p.climateScore || 0 }));
  } else {
    const scoreMap = load(CX.SCORES, {});
    ranked = profiles.map(p => {
      const history = (scoreMap[p.uid] || []).filter(h => h.timestamp >= cutoff);
      const periodDelta = history.reduce((s, h) => s + h.delta, 0);
      return { ...p, displayScore: Math.max(0, (p.climateScore || 0) + periodDelta), periodDelta };
    });
  }

  return ranked
    .sort((a, b) => b.displayScore - a.displayScore)
    .slice(0, limit)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

export function getUserRank(userId, filter = 'all-time') {
  const board = getLeaderboard(filter, 999);
  const entry = board.find(p => p.uid === userId);
  return entry ? entry.rank : null;
}

export function getRankTrend(userId) {
  const allTime = getUserRank(userId, 'all-time');
  const weekly  = getUserRank(userId, 'weekly');
  if (!allTime || !weekly) return 'stable';
  if (weekly < allTime) return 'up';
  if (weekly > allTime) return 'down';
  return 'stable';
}

// ═══════════════════════════════════════════════════════════════════════════
// ── DAILY CHALLENGES & STREAKS ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export function getDailyState(userId) {
  const key = `cx_chal_${userId}_${todayKey()}`;
  const existing = load(key, null);
  if (existing) return existing;

  const fresh = {
    date: todayKey(), userId,
    challenges: CHALLENGE_DEFS.map(c => ({
      id: c.id, label: c.label, desc: c.desc, icon: c.icon, points: c.points,
      progress: 0, target: c.id === 'engage_three' ? 3 : 1, completed: false,
    })),
    allCompleted: false, bonusAwarded: false,
  };
  save(key, fresh);
  return fresh;
}

export function updateChallengeProgress(userId, challengeId) {
  const key = `cx_chal_${userId}_${todayKey()}`;
  const state = getDailyState(userId);
  const ch = state.challenges.find(c => c.id === challengeId);
  if (!ch || ch.completed) return state;

  ch.progress = Math.min(ch.target, ch.progress + 1);
  if (ch.progress >= ch.target) {
    ch.completed = true;
    updateClimateScore(userId, SCORE_EVENTS.CHALLENGE_COMPLETE.delta, SCORE_EVENTS.CHALLENGE_COMPLETE.label);
    addSystemNotification(userId, {
      type: 'challenge', message: `Challenge complete: "${ch.label}" +${ch.points} pts 🏆`,
      priority: 'important',
    });
  }

  state.allCompleted = state.challenges.every(c => c.completed);
  if (state.allCompleted && !state.bonusAwarded) {
    state.bonusAwarded = true;
    updateClimateScore(userId, SCORE_EVENTS.STREAK_BONUS.delta, SCORE_EVENTS.STREAK_BONUS.label);
    _incrementStreak(userId);
  }

  save(key, state);
  return state;
}

function _incrementStreak(userId) {
  const streaks = load(CX.STREAKS, {});
  const today = todayKey();
  const yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  if (!streaks[userId]) streaks[userId] = { current: 0, longest: 0, lastDay: null };
  const s = streaks[userId];

  if (s.lastDay === today) return;
  if (s.lastDay === yesterday) {
    s.current++;
  } else {
    s.current = 1;
  }
  s.lastDay = today;
  s.longest = Math.max(s.longest, s.current);
  save(CX.STREAKS, streaks);

  addSystemNotification(userId, {
    type: 'streak',
    message: `${s.current}-day streak! 🔥 Keep it up!`,
    priority: 'important',
  });
}

export function getStreak(userId) {
  const streaks = load(CX.STREAKS, {});
  return streaks[userId] || { current: 0, longest: 0, lastDay: null };
}

// ═══════════════════════════════════════════════════════════════════════════
// ── REACTIONS (replaces plain likes) ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export function addReaction(postId, userId, reactionType) {
  if (!REACTION_TYPES[reactionType]) return null;
  const reactions = load(CX.REACTIONS, {});
  if (!reactions[postId]) reactions[postId] = {};

  const prev = reactions[postId][userId];
  if (prev === reactionType) {
    delete reactions[postId][userId];
  } else {
    reactions[postId][userId] = reactionType;
    // Notify post author
    const post = getPosts().find(p => p.id === postId);
    if (post && post.authorId !== userId) {
      const by = getProfile(userId);
      const rt = REACTION_TYPES[reactionType];
      addNotification(post.authorId, {
        type: 'reaction', fromId: userId,
        fromName: by?.fullName || 'Someone',
        postId, message: `reacted ${rt.emoji} ${rt.label} to your post`,
        priority: 'normal',
      });
      updateClimateScore(post.authorId, SCORE_EVENTS.REACTION_RECEIVED.delta, SCORE_EVENTS.REACTION_RECEIVED.label);
    }
    // Challenge progress
    updateChallengeProgress(userId, 'engage_three');
  }

  save(CX.REACTIONS, reactions);
  return getReactions(postId);
}

export function getReactions(postId) {
  const reactions = load(CX.REACTIONS, {});
  const map = reactions[postId] || {};
  const counts = {};
  Object.values(map).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  return { counts, total, byUser: map };
}

export function getUserReaction(postId, userId) {
  return (load(CX.REACTIONS, {})[postId] || {})[userId] || null;
}

export function getTotalReactions(postId) {
  return getReactions(postId).total;
}

// ═══════════════════════════════════════════════════════════════════════════
// ── SOLUTION HUB ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export function getSolutions(filter = 'all') {
  const all = load(CX.SOLUTIONS, SEED_SOLUTIONS);
  if (filter === 'top') {
    const weekAgo = Date.now() - 7 * 86400000;
    return [...all].sort((a, b) => (b.upvotes?.length || 0) - (a.upvotes?.length || 0))
      .filter(s => s.timestamp >= weekAgo || (s.upvotes?.length || 0) > 2)
      .slice(0, 5);
  }
  return all;
}

export function createSolution({ authorId, authorName, authorAvatar, authorRole, title, problem, solution, impact, industry, fundingRequired, tags, collaborationOpen }) {
  const all = load(CX.SOLUTIONS, SEED_SOLUTIONS);
  const entry = {
    id: 'sol' + Date.now(), authorId, authorName,
    authorAvatar: authorAvatar || getInitials(authorName),
    authorRole: authorRole || 'individual',
    title, problem, solution, impact,
    industry: industry || 'General', fundingRequired: fundingRequired || '',
    collaborationOpen: !!collaborationOpen,
    tags: tags || [], upvotes: [], bookmarks: [],
    timestamp: Date.now(), verified: false,
  };
  save(CX.SOLUTIONS, [entry, ...all]);
  updateClimateScore(authorId, SCORE_EVENTS.SOLUTION_CREATED.delta, SCORE_EVENTS.SOLUTION_CREATED.label);
  updateChallengeProgress(authorId, 'upload_init');
  return entry;
}

export function toggleSolutionUpvote(solutionId, userId) {
  const all = load(CX.SOLUTIONS, SEED_SOLUTIONS);
  const sol = all.find(s => s.id === solutionId);
  if (!sol) return null;
  if (!sol.upvotes) sol.upvotes = [];
  const idx = sol.upvotes.indexOf(userId);
  if (idx > -1) sol.upvotes.splice(idx, 1);
  else sol.upvotes.push(userId);
  save(CX.SOLUTIONS, all);
  return idx === -1;
}

export function toggleSolutionBookmark(solutionId, userId) {
  const all = load(CX.SOLUTIONS, SEED_SOLUTIONS);
  const sol = all.find(s => s.id === solutionId);
  if (!sol) return null;
  if (!sol.bookmarks) sol.bookmarks = [];
  const idx = sol.bookmarks.indexOf(userId);
  if (idx > -1) sol.bookmarks.splice(idx, 1);
  else sol.bookmarks.push(userId);
  save(CX.SOLUTIONS, all);
  return idx === -1;
}

export function isSolutionUpvoted(solutionId, userId) {
  const sol = (load(CX.SOLUTIONS, SEED_SOLUTIONS)).find(s => s.id === solutionId);
  return (sol?.upvotes || []).includes(userId);
}

// ═══════════════════════════════════════════════════════════════════════════
// ── BATTLE MODE ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export function getBattles() {
  return load(CX.BATTLES, SEED_BATTLES);
}

export function createBattle({ title, sideA, sideB, authorId }) {
  const battles = load(CX.BATTLES, SEED_BATTLES);
  const battle = {
    id: 'bat' + Date.now(),
    title, sideA, sideB,
    criteria: ['Impact', 'Innovation', 'Scalability'],
    votes: { sideA: {}, sideB: {} },
    totalA: 0, totalB: 0,
    status: 'active', authorId,
    timestamp: Date.now(),
  };
  save(CX.BATTLES, [battle, ...battles]);
  return battle;
}

export function voteInBattle(battleId, userId, side) {
  const battles = load(CX.BATTLES, SEED_BATTLES);
  const battle = battles.find(b => b.id === battleId);
  if (!battle) return null;
  if (!battle.votes) battle.votes = { sideA: {}, sideB: {} };

  const otherSide = side === 'sideA' ? 'sideB' : 'sideA';
  const alreadyVoted = battle.votes[side][userId] || battle.votes[otherSide][userId];

  if (alreadyVoted) {
    // Toggle off same side, or switch
    if (battle.votes[side][userId]) {
      delete battle.votes[side][userId];
    } else {
      delete battle.votes[otherSide][userId];
      battle.votes[side][userId] = true;
    }
  } else {
    battle.votes[side][userId] = true;
  }

  battle.totalA = Object.keys(battle.votes.sideA).length;
  battle.totalB = Object.keys(battle.votes.sideB).length;
  save(CX.BATTLES, battles);
  return { totalA: battle.totalA, totalB: battle.totalB, userVote: battle.votes[side][userId] ? side : null };
}

export function getUserBattleVote(battleId, userId) {
  const battle = (load(CX.BATTLES, SEED_BATTLES)).find(b => b.id === battleId);
  if (!battle?.votes) return null;
  if (battle.votes.sideA?.[userId]) return 'sideA';
  if (battle.votes.sideB?.[userId]) return 'sideB';
  return null;
}

export function getTrendingBattles(limit = 3) {
  return getBattles()
    .filter(b => b.status === 'active')
    .sort((a, b) => (b.totalA + b.totalB) - (a.totalA + a.totalB))
    .slice(0, limit);
}
