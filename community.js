// ── Climactix Global · Community Platform Data Layer ───────────────────────
// Version: 1.0 (MVP) · LocalStorage-based · Firebase/Supabase-ready upgrade path
// Schema: Posts · Profiles · Follows · Bookmarks · Forum Threads · Funding Requests

'use strict';

// ── Storage keys ───────────────────────────────────────────────────────────
const CX = {
  POSTS:     'cx_posts_v1',
  PROFILES:  'cx_profiles_v1',
  FOLLOWS:   'cx_follows_v1',
  BOOKMARKS: 'cx_bookmarks_v1',
  FORUM:     'cx_forum_v1',
  NOTIFS:    'cx_notifs_v1',
};

// ── Role configuration ─────────────────────────────────────────────────────
export const ROLES = {
  individual:  { label: 'Individual',     color: '#374151', bg: '#F3F4F6' },
  startup:     { label: 'Climate Startup', color: '#0B3D2E', bg: '#D1FAE5' },
  corporate:   { label: 'Corporate / ESG', color: '#1D4ED8', bg: '#DBEAFE' },
  investor:    { label: 'Investor / VC',   color: '#92400E', bg: '#FEF3C7' },
  researcher:  { label: 'Researcher / NGO', color: '#5B21B6', bg: '#EDE9FE' },
};

// ── Avatar color map (by role) ─────────────────────────────────────────────
export const AVATAR_COLORS = {
  individual:  '#4B5563',
  startup:     '#0B3D2E',
  corporate:   '#1D4ED8',
  investor:    '#92400E',
  researcher:  '#5B21B6',
};

// ── Seed community profiles ────────────────────────────────────────────────
const SEED_PROFILES = [
  {
    uid: 'seed_priya',
    fullName: 'Priya Sharma',
    email: 'priya@greenfuture.in',
    role: 'startup',
    bio: 'Founder & CEO @ GreenFuture Energy · Solar micro-grids for rural India · Forbes 30U30 · UNDP Climate Champion · IIT Bombay',
    location: 'Mumbai, India',
    interests: ['Solar Energy', 'Rural Electrification', 'Impact Finance', 'Women in Climate'],
    climateScore: 87,
    followersCount: 1247,
    followingCount: 340,
    postsCount: 48,
    verified: true,
    avatar: 'PS',
    company: 'GreenFuture Energy',
    website: 'greenfuture.in',
    portfolio: [
      { name: 'Solar Micro-Grid Pilot – Maharashtra', impact: '12,000 homes powered' },
      { name: 'Women Energy Entrepreneurs Program', impact: '240 local jobs' },
    ],
  },
  {
    uid: 'seed_arjun',
    fullName: 'Arjun Kapoor',
    email: 'arjun@sequoiaclimate.com',
    role: 'investor',
    bio: 'Partner @ Sequoia Climate Fund · $2B+ deployed in climate tech · Board: 7 unicorns · Oxford MBA · Angel: 40+ climate startups',
    location: 'New Delhi, India',
    interests: ['Climate Finance', 'Deep Tech', 'Carbon Markets', 'Green Infrastructure'],
    climateScore: 91,
    followersCount: 8932,
    followingCount: 412,
    postsCount: 127,
    verified: true,
    avatar: 'AK',
    company: 'Sequoia Climate Fund',
    website: 'sequoiaclimate.com',
    portfolio: [
      { name: 'Series A: GreenFuture Energy', impact: '$6M · Solar' },
      { name: 'Series B: CarbonTrace AI', impact: '$12M · MRV' },
    ],
  },
  {
    uid: 'seed_meera',
    fullName: 'Dr. Meera Nair',
    email: 'meera@iitd.ac.in',
    role: 'researcher',
    bio: 'Climate Scientist @ IIT Delhi · IPCC AR6 Contributing Author · Carbon capture & enhanced weathering research · 120+ publications',
    location: 'New Delhi, India',
    interests: ['Carbon Capture', 'Climate Policy', 'IPCC Research', 'Enhanced Weathering'],
    climateScore: 94,
    followersCount: 3120,
    followingCount: 890,
    postsCount: 89,
    verified: true,
    avatar: 'MN',
    company: 'IIT Delhi',
    website: 'iitd.ac.in',
    portfolio: [],
  },
  {
    uid: 'seed_rahul',
    fullName: 'Rahul Menon',
    email: 'rahul.menon@tata.com',
    role: 'corporate',
    bio: 'Head of ESG Strategy @ Tata Group · Net Zero 2040 program lead · CSRD & ISSB compliance · GRI Certified Practitioner · Ex-McKinsey',
    location: 'Bangalore, India',
    interests: ['ESG Reporting', 'Net Zero Strategy', 'CSRD', 'Supply Chain Decarbonisation'],
    climateScore: 78,
    followersCount: 5601,
    followingCount: 220,
    postsCount: 203,
    verified: true,
    avatar: 'RM',
    company: 'Tata Group',
    portfolio: [],
  },
  {
    uid: 'seed_aisha',
    fullName: 'Aisha Patel',
    email: 'aisha@climateadvocate.in',
    role: 'individual',
    bio: 'Climate activist & sustainability consultant · Ex-WWF India · Youth delegate at COP28 · Building towards a just, net-zero future',
    location: 'Pune, India',
    interests: ['Climate Activism', 'Sustainability', 'Policy Advocacy', 'Climate Justice'],
    climateScore: 62,
    followersCount: 890,
    followingCount: 1240,
    postsCount: 34,
    verified: false,
    avatar: 'AP',
    company: '',
  },
  {
    uid: 'seed_dev',
    fullName: 'Dev Krishnan',
    email: 'dev@carbontrace.ai',
    role: 'startup',
    bio: 'Co-founder @ CarbonTrace AI · ML engineer turned climate entrepreneur · Building AI-powered MRV for voluntary carbon markets · Techstars \'24',
    location: 'Bangalore, India',
    interests: ['Carbon Markets', 'AI/ML', 'MRV Technology', 'Satellite Data'],
    climateScore: 79,
    followersCount: 642,
    followingCount: 480,
    postsCount: 22,
    verified: false,
    avatar: 'DK',
    company: 'CarbonTrace AI',
  },
];

// ── Seed posts ─────────────────────────────────────────────────────────────
const SEED_POSTS = [
  {
    id: 'p001',
    authorId: 'seed_priya',
    authorName: 'Priya Sharma',
    authorRole: 'startup',
    authorAvatar: 'PS',
    authorVerified: true,
    authorCompany: 'GreenFuture Energy',
    type: 'solution',
    content: `Thrilled to announce: GreenFuture Energy has deployed 500 solar micro-grids across rural Maharashtra — powering 12,000+ homes that previously had zero reliable electricity.\n\nOur model:\n→ Community-owned micro-grids (not just CSR)\n→ Pay-as-you-go solar (₹2/day per household)\n→ WhatsApp-based monitoring for local operators\n→ 100% women-led installation teams\n\nImpact so far:\n📊 18,000 tonnes CO₂ avoided annually\n💡 99.2% uptime vs 6hrs/day from grid\n👩‍🔧 240 local jobs created\n💰 $1.2M in household energy savings/year\n\nWe're raising Series A to scale to 5,000 villages. DM for pitch deck.`,
    tags: ['SolarEnergy', 'RuralElectrification', 'ClimateTech', 'ImpactInvesting', 'NetZero'],
    likes: ['seed_arjun', 'seed_meera', 'seed_rahul', 'seed_aisha', 'seed_dev'],
    comments: [
      {
        id: 'c001',
        authorId: 'seed_arjun',
        authorName: 'Arjun Kapoor',
        authorRole: 'investor',
        authorAvatar: 'AK',
        content: 'Incredible impact metrics, Priya! The pay-as-you-go model is exactly what scales in these markets. Would love to connect and discuss Series A details.',
        timestamp: Date.now() - 1.5 * 3600000,
        likes: ['seed_meera', 'seed_priya'],
      },
      {
        id: 'c002',
        authorId: 'seed_meera',
        authorName: 'Dr. Meera Nair',
        authorRole: 'researcher',
        authorAvatar: 'MN',
        content: '18,000 tCO₂e avoidance is significant at this scale. Would love to co-author a paper on methodology. Are you open to sharing operational data for our rural energy research at IIT Delhi?',
        timestamp: Date.now() - 45 * 60000,
        likes: ['seed_priya'],
      },
    ],
    views: 4821,
    timestamp: Date.now() - 3 * 3600000,
  },
  {
    id: 'p002',
    authorId: 'seed_arjun',
    authorName: 'Arjun Kapoor',
    authorRole: 'investor',
    authorAvatar: 'AK',
    authorVerified: true,
    authorCompany: 'Sequoia Climate Fund',
    type: 'funding',
    content: `Sequoia Climate Fund is actively deploying capital in Q2 2025.\n\nWe're specifically looking for:\n\n🔋 Energy Storage: Novel chemistries, grid-scale solutions\n🌊 Blue Carbon: Mangrove/seagrass restoration with MRV\n🏗️ Green Construction: Embodied carbon reduction tech\n🚜 AgriTech Climate: Soil carbon, precision farming\n\nTicket size: $2M–$25M (Seed to Series B)\nGeography: India, SEA, MENA\nClimate Impact Score requirement: >70 on Climactix\n\nFounders: Tag your startup below or DM with 3-slide teaser. No cold emails — use Climactix Connect.\n\nInvestors: Happy to co-invest on high-conviction deals. Let's talk.`,
    tags: ['ClimateVC', 'ImpactInvesting', 'GreenTech', 'SeriesA', 'ClimateFunding'],
    likes: ['seed_priya', 'seed_meera', 'seed_aisha', 'seed_dev'],
    comments: [
      {
        id: 'c003',
        authorId: 'seed_dev',
        authorName: 'Dev Krishnan',
        authorRole: 'startup',
        authorAvatar: 'DK',
        content: 'CarbonTrace AI checks a few of these boxes — AI-powered MRV for voluntary carbon markets. We just closed Techstars Climate. DM sent!',
        timestamp: Date.now() - 2 * 3600000,
        likes: ['seed_arjun'],
      },
      {
        id: 'c004',
        authorId: 'seed_aisha',
        authorName: 'Aisha Patel',
        authorRole: 'individual',
        authorAvatar: 'AP',
        content: 'Do you consider pre-revenue startups with strong impact metrics and a validated pilot? Asking for a friend (literally).',
        timestamp: Date.now() - 90 * 60000,
        likes: [],
      },
    ],
    views: 9234,
    timestamp: Date.now() - 5 * 3600000,
  },
  {
    id: 'p003',
    authorId: 'seed_meera',
    authorName: 'Dr. Meera Nair',
    authorRole: 'researcher',
    authorAvatar: 'MN',
    authorVerified: true,
    authorCompany: 'IIT Delhi',
    type: 'research',
    content: `New research published: Enhanced weathering as a carbon removal pathway at gigaton scale.\n\nKey findings:\n• Basalt weathering can sequester 0.5–2.0 GtCO₂/year globally by 2050\n• Cost curve: $50–120/tonne (vs $300+ for DAC)\n• Co-benefit: 15–25% crop yield increase in alkaline-deficient soils\n• MRV methodology now validated across 3 Indian states\n\nThis could be a MASSIVE opportunity for India — we have both the geology and the agricultural land to lead globally in this space.\n\nFull paper: Nature Climate Change (link in first comment)\nDataset: available for academic partners on request\n\nSeeking implementation partners — climate startups, state govts, CSR funds. Tag anyone working in carbon removal or regenerative agriculture.`,
    tags: ['CarbonRemoval', 'EnhancedWeathering', 'ClimateScience', 'CarbonMarkets', 'IPCC'],
    likes: ['seed_arjun', 'seed_rahul', 'seed_priya'],
    comments: [],
    views: 6102,
    timestamp: Date.now() - 8 * 3600000,
  },
  {
    id: 'p004',
    authorId: 'seed_rahul',
    authorName: 'Rahul Menon',
    authorRole: 'corporate',
    authorAvatar: 'RM',
    authorVerified: true,
    authorCompany: 'Tata Group',
    type: 'update',
    content: `Hot take: Most corporate ESG reports are still theater.\n\nAfter reviewing 50+ reports this quarter, here's what separates leaders from laggards:\n\nLaggards:\n✗ Scope 3 completely ignored or cherry-picked\n✗ No third-party assurance\n✗ Targets without interim milestones\n✗ "Sustainability page on website" = entire strategy\n\nLeaders:\n✓ Full Scope 1-2-3 disclosure with GHG Protocol methodology\n✓ ISSB IFRS S2 aligned — decision-useful for investors\n✓ Science-based targets with annual public tracking\n✓ CSRD-ready for EU market access\n✓ Board-level climate risk governance with named accountability\n\nThe SEBI BRSR Core mandate is forcing Indian corporates to level up — and honestly, it's about time.\n\nWhere does your company stand? Be honest in the comments.`,
    tags: ['ESG', 'CSRDCompliance', 'SustainabilityReporting', 'ISSB', 'NetZero', 'SEBI'],
    likes: ['seed_meera', 'seed_aisha', 'seed_arjun'],
    comments: [],
    views: 12450,
    timestamp: Date.now() - 12 * 3600000,
  },
  {
    id: 'p005',
    authorId: 'seed_dev',
    authorName: 'Dev Krishnan',
    authorRole: 'startup',
    authorAvatar: 'DK',
    authorVerified: false,
    authorCompany: 'CarbonTrace AI',
    type: 'update',
    content: `We just shipped something that I think will change how voluntary carbon markets operate in India.\n\nCarbonTrace AI now integrates with:\n→ Sentinel-2 satellite imagery (10m resolution)\n→ IoT soil sensors (LoRaWAN network)\n→ Gold Standard API (direct credit issuance)\n\nResult: Carbon credit verification that used to take 18 months and cost $50K now takes 30 days and costs $2K.\n\nWe're opening our beta to 20 project developers — priority for cookstove, REDD+, and soil carbon projects in India.\n\nLink in bio. Zero equity, zero lock-in during beta.`,
    tags: ['CarbonMarkets', 'MRV', 'AITech', 'VoluntaryCarbonMarket', 'ClimateStartup'],
    likes: ['seed_meera', 'seed_priya'],
    comments: [],
    views: 2341,
    timestamp: Date.now() - 18 * 3600000,
  },
];

// ── Seed forum threads ─────────────────────────────────────────────────────
export const SEED_THREADS = [
  {
    id: 'f001',
    community: 'renewable-energy',
    communityName: 'Renewable Energy',
    communityColor: '#0B3D2E',
    title: 'Battery storage economics: Has the tipping point arrived for grid-scale storage in India?',
    body: 'BESS costs have dropped 89% since 2010. With recent SECI tenders showing Rs 2.4/kWh for 4-hour storage, are we finally at the inflection point where storage makes solar truly dispatchable without subsidies? Share data, models, or real-world project economics.',
    authorId: 'seed_priya',
    authorName: 'Priya Sharma',
    authorAvatar: 'PS',
    authorRole: 'startup',
    upvotes: 234,
    downvotes: 12,
    replyCount: 47,
    tags: ['BESS', 'GridStorage', 'SolarIndia', 'EnergyTransition'],
    timestamp: Date.now() - 4 * 3600000,
    pinned: true,
  },
  {
    id: 'f002',
    community: 'carbon-markets',
    communityName: 'Carbon Markets',
    communityColor: '#1D4ED8',
    title: 'Article 6 rulebook final: What it means for Indian carbon credit developers',
    body: 'COP29 finally delivered Article 6.4 rules. For project developers in India: ITMO registry now mandatory, additionality criteria tightened, host country authorization template published. Posting this thread for the community to share analysis and implications.',
    authorId: 'seed_meera',
    authorName: 'Dr. Meera Nair',
    authorAvatar: 'MN',
    authorRole: 'researcher',
    upvotes: 187,
    downvotes: 8,
    replyCount: 63,
    tags: ['Article6', 'CarbonMarkets', 'COP29', 'VCM', 'ITMO'],
    timestamp: Date.now() - 6 * 3600000,
    pinned: false,
  },
  {
    id: 'f003',
    community: 'esg-reporting',
    communityName: 'ESG Reporting',
    communityColor: '#92400E',
    title: 'BRSR Core vs GRI vs ISSB: Which framework should Indian mid-caps prioritize in 2025?',
    body: "Seeing a lot of confusion among mid-cap CFOs about which ESG framework to prioritize. SEBI mandates BRSR Core for top 1000 listed companies. But if you're eyeing EU markets, CSRD matters. And global investors want ISSB IFRS S2. Let's map this out.",
    authorId: 'seed_rahul',
    authorName: 'Rahul Menon',
    authorAvatar: 'RM',
    authorRole: 'corporate',
    upvotes: 312,
    downvotes: 4,
    replyCount: 89,
    tags: ['BRSR', 'ISSB', 'GRI', 'ESGReporting', 'SEBI', 'CSRD'],
    timestamp: Date.now() - 10 * 3600000,
    pinned: false,
  },
  {
    id: 'f004',
    community: 'climate-finance',
    communityName: 'Climate Finance',
    communityColor: '#5B21B6',
    title: 'Blended finance structures that actually work for early-stage climate startups — share real examples',
    body: "Most blended finance discussions stay theoretical. This thread is for practitioners only: share actual deal structures, DFI instruments, concessional tranches, and what made them bankable. First-loss capital, guarantees, green bonds — real examples please.",
    authorId: 'seed_arjun',
    authorName: 'Arjun Kapoor',
    authorAvatar: 'AK',
    authorRole: 'investor',
    upvotes: 156,
    downvotes: 3,
    replyCount: 34,
    tags: ['BlendedFinance', 'ClimateFinance', 'DFI', 'GreenBonds'],
    timestamp: Date.now() - 15 * 3600000,
    pinned: false,
  },
  {
    id: 'f005',
    community: 'nature-solutions',
    communityName: 'Nature-Based Solutions',
    communityColor: '#065F46',
    title: 'Mangrove carbon credits: MRV methodology gap is killing projects — what are the solutions?',
    body: "Blue carbon projects (mangroves, seagrass) sequester 3-5x more CO₂ per hectare than forests, but getting credits verified is a nightmare. The methodology gap between what satellites can see and what Verra/GS will accept is a real bottleneck. Who's solving this?",
    authorId: 'seed_dev',
    authorName: 'Dev Krishnan',
    authorAvatar: 'DK',
    authorRole: 'startup',
    upvotes: 98,
    downvotes: 5,
    replyCount: 22,
    tags: ['BlueCarbon', 'MangroveRestoration', 'MRV', 'NaturalCapital'],
    timestamp: Date.now() - 24 * 3600000,
    pinned: false,
  },
];

// ── Seed funding requests ──────────────────────────────────────────────────
export const SEED_FUNDING = [
  {
    id: 'fr001',
    startupName: 'GreenFuture Energy',
    founderName: 'Priya Sharma',
    founderAvatar: 'PS',
    founderRole: 'startup',
    stage: 'Series A',
    sector: 'Solar Energy',
    geography: 'India – Maharashtra, MP, UP',
    ask: '₹50 Cr ($6M)',
    valuationPre: '₹200 Cr',
    climateScore: 87,
    sdgAlignment: ['SDG 7', 'SDG 13', 'SDG 5'],
    problem: '300M rural Indians have no reliable electricity. Grid extension costs $2,000+ per connection and takes 5+ years.',
    solution: 'Community-owned solar micro-grids with pay-as-you-go model at $150/connection. WhatsApp-based O&M platform.',
    impact: '18,000 tCO₂e/year avoided · 12,000 homes powered · 240 women-led jobs created · $1.2M household savings/year',
    traction: '500 villages · ₹2.1Cr ARR · 99.2% uptime · 94% customer retention · MNRE registered',
    useOfFunds: '60% – Scale to 5,000 villages, 3 states · 25% – 15 MW installed capacity · 15% – Working capital',
    tags: ['Solar', 'RuralElectrification', 'PayAsYouGo', 'SeriesA', 'WomenLed'],
    expressedInterest: 14,
    savedBy: 32,
    hasDeck: true,
    timestamp: Date.now() - 2 * 86400000,
  },
  {
    id: 'fr002',
    startupName: 'CarbonTrace AI',
    founderName: 'Dev Krishnan',
    founderAvatar: 'DK',
    founderRole: 'startup',
    stage: 'Seed',
    sector: 'Carbon Markets / AI',
    geography: 'India, Southeast Asia',
    ask: '$1.5M',
    valuationPre: '$8M',
    climateScore: 79,
    sdgAlignment: ['SDG 13', 'SDG 17'],
    problem: 'Carbon credit verification takes 18 months and costs $50K+, blocking 80% of small project developers from accessing voluntary carbon markets.',
    solution: 'AI + satellite + IoT MRV platform. 30-day verification at $2K/project. Direct API integration with Gold Standard & Verra.',
    impact: 'Unlocking 500+ small projects · 2M tCO₂e/year newly verifiable · $40M in carbon credits democratized',
    traction: '12 pilot projects · 2 LOIs signed · Techstars Climate \'24 · $180K pre-seed closed',
    useOfFunds: '50% – Satellite API integration & model training · 30% – 3 country partnerships · 20% – Team',
    tags: ['CarbonMarkets', 'MRV', 'AI', 'Seed', 'SaaS'],
    expressedInterest: 8,
    savedBy: 19,
    hasDeck: true,
    timestamp: Date.now() - 3 * 86400000,
  },
  {
    id: 'fr003',
    startupName: 'RegenSoil Tech',
    founderName: 'Kavita Reddy',
    founderAvatar: 'KR',
    founderRole: 'startup',
    stage: 'Pre-Seed',
    sector: 'AgriTech / Soil Carbon',
    geography: 'India – Telangana, Karnataka',
    ask: '$500K',
    valuationPre: '$3M',
    climateScore: 71,
    sdgAlignment: ['SDG 2', 'SDG 13', 'SDG 15'],
    problem: 'Indian agriculture contributes 18% of national GHG emissions. Soil degradation reduces yields by 30% while smallholders have no access to carbon markets.',
    solution: 'Precision soil carbon measurement + regenerative farming advisory via mobile app. Aggregates smallholder credits for certification.',
    impact: '50 tCO₂e/farm/year sequestered · 20% yield increase · ₹8,000/acre additional income for farmers',
    traction: '200 farmers enrolled · 3 FPOs signed · NABARD grant ₹25L received · Pilot data published',
    useOfFunds: '40% – IoT sensor deployment · 35% – Carbon credit certification process · 25% – Team & ops',
    tags: ['AgriTech', 'SoilCarbon', 'RegenerativeFarming', 'PreSeed', 'FPO'],
    expressedInterest: 5,
    savedBy: 11,
    hasDeck: false,
    timestamp: Date.now() - 5 * 86400000,
  },
  {
    id: 'fr004',
    startupName: 'BlueTide Marine',
    founderName: 'Aryan Shah',
    founderAvatar: 'AS',
    founderRole: 'startup',
    stage: 'Seed',
    sector: 'Blue Carbon / Ocean',
    geography: 'India – Sundarbans, Gujarat Coast',
    ask: '$2M',
    valuationPre: '$10M',
    climateScore: 83,
    sdgAlignment: ['SDG 14', 'SDG 13', 'SDG 1'],
    problem: 'India has 4,900 km of coastline with degraded mangroves sequestering 60% less CO₂ than healthy ecosystems. No scalable restoration + MRV solution exists.',
    solution: 'Drone-assisted mangrove restoration with satellite-validated MRV. Community-based model with fishing communities as carbon stewards.',
    impact: '500 ha restored · 125,000 tCO₂e/year sequestered · 1,200 coastal livelihoods supported',
    traction: '50 ha pilot complete · Verra methodology submission in progress · State Forest Dept MoU signed',
    useOfFunds: '55% – Restoration operations 500 ha · 30% – MRV infrastructure & methodology · 15% – Community programs',
    tags: ['BlueCarbon', 'Mangroves', 'OceanResilience', 'Seed', 'NBS'],
    expressedInterest: 11,
    savedBy: 24,
    hasDeck: true,
    timestamp: Date.now() - 7 * 86400000,
  },
];

// ── Communities list ───────────────────────────────────────────────────────
export const COMMUNITIES = [
  { id: 'renewable-energy',   name: 'Renewable Energy',       members: 12840, color: '#0B3D2E', icon: '⚡' },
  { id: 'carbon-markets',     name: 'Carbon Markets',          members: 8920,  color: '#1D4ED8', icon: '🌿' },
  { id: 'esg-reporting',      name: 'ESG Reporting',           members: 15320, color: '#92400E', icon: '📊' },
  { id: 'climate-finance',    name: 'Climate Finance',         members: 9410,  color: '#5B21B6', icon: '💰' },
  { id: 'nature-solutions',   name: 'Nature-Based Solutions',  members: 6730,  color: '#065F46', icon: '🌱' },
  { id: 'green-mobility',     name: 'Green Mobility / EVs',    members: 11200, color: '#0369A1', icon: '🚗' },
  { id: 'circular-economy',   name: 'Circular Economy',        members: 5890,  color: '#B45309', icon: '♻️' },
  { id: 'climate-policy',     name: 'Climate Policy',          members: 7640,  color: '#9D174D', icon: '🏛️' },
];

// ── Utility functions ──────────────────────────────────────────────────────

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
  return n.toString();
}

export function getRoleConfig(role) {
  return ROLES[role] || ROLES.individual;
}

export function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

export function getAvatarColor(role) {
  return AVATAR_COLORS[role] || AVATAR_COLORS.individual;
}

// ── Storage helpers ────────────────────────────────────────────────────────

function load(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

function save(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

// ── Initialization ─────────────────────────────────────────────────────────

export function initCommunity() {
  if (!load(CX.POSTS))    save(CX.POSTS, SEED_POSTS);
  if (!load(CX.PROFILES)) save(CX.PROFILES, SEED_PROFILES);
}

// ── Session / current user ─────────────────────────────────────────────────

export function getCurrentSession() {
  return load('cx_session', null);
}

export function getCurrentUserProfile() {
  const session = getCurrentSession();
  if (!session) return null;

  const profiles = load(CX.PROFILES, SEED_PROFILES);
  const existing = profiles.find(p => p.uid === (session.uid || session.email) || p.email === session.email);
  if (existing) return existing;

  // Auto-create profile for authenticated user
  const newProfile = {
    uid: session.uid || session.email,
    fullName: session.fullName || 'Climate Professional',
    email: session.email || '',
    role: 'individual',
    bio: 'Climate professional on Climactix Global',
    location: '',
    interests: [],
    climateScore: 0,
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    verified: session.verified || false,
    avatar: getInitials(session.fullName || 'CP'),
    company: session.companyName || '',
  };

  const updated = [...profiles, newProfile];
  save(CX.PROFILES, updated);
  return newProfile;
}

// ── Profile operations ─────────────────────────────────────────────────────

export function getProfiles() {
  return load(CX.PROFILES, SEED_PROFILES);
}

export function getProfile(uid) {
  return getProfiles().find(p => p.uid === uid) || null;
}

export function updateProfile(uid, updates) {
  const profiles = getProfiles();
  const idx = profiles.findIndex(p => p.uid === uid);
  if (idx === -1) return false;
  profiles[idx] = { ...profiles[idx], ...updates };
  save(CX.PROFILES, profiles);
  return true;
}

// ── Post operations ────────────────────────────────────────────────────────

export function getPosts() {
  return load(CX.POSTS, SEED_POSTS);
}

export function createPost({ authorId, authorName, authorRole, authorAvatar, authorVerified, authorCompany, type, content, tags }) {
  const posts = getPosts();
  const newPost = {
    id: 'p' + Date.now(),
    authorId,
    authorName,
    authorRole: authorRole || 'individual',
    authorAvatar: authorAvatar || getInitials(authorName),
    authorVerified: !!authorVerified,
    authorCompany: authorCompany || '',
    type: type || 'update',
    content: content.trim(),
    tags: tags || [],
    likes: [],
    comments: [],
    views: Math.floor(Math.random() * 50) + 10,
    timestamp: Date.now(),
  };
  save(CX.POSTS, [newPost, ...posts]);
  return newPost;
}

export function toggleLike(postId, userId) {
  const posts = getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return null;
  const idx = post.likes.indexOf(userId);
  if (idx > -1) post.likes.splice(idx, 1);
  else post.likes.push(userId);
  save(CX.POSTS, posts);
  return { count: post.likes.length, liked: idx === -1 };
}

export function isLiked(postId, userId) {
  const posts = getPosts();
  const post = posts.find(p => p.id === postId);
  return post ? post.likes.includes(userId) : false;
}

export function addComment(postId, { authorId, authorName, authorRole, authorAvatar, content }) {
  const posts = getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return null;
  const comment = {
    id: 'c' + Date.now(),
    authorId, authorName, authorRole,
    authorAvatar: authorAvatar || getInitials(authorName),
    content: content.trim(),
    timestamp: Date.now(),
    likes: [],
  };
  post.comments.push(comment);
  save(CX.POSTS, posts);
  return comment;
}

// ── Bookmark operations ────────────────────────────────────────────────────

export function toggleBookmark(postId, userId) {
  const bookmarks = load(CX.BOOKMARKS, []);
  const key = `${userId}:${postId}`;
  const idx = bookmarks.indexOf(key);
  if (idx > -1) bookmarks.splice(idx, 1);
  else bookmarks.push(key);
  save(CX.BOOKMARKS, bookmarks);
  return idx === -1;
}

export function isBookmarked(postId, userId) {
  return load(CX.BOOKMARKS, []).includes(`${userId}:${postId}`);
}

// ── Follow operations ──────────────────────────────────────────────────────

export function toggleFollow(targetId, currentUserId) {
  const follows = load(CX.FOLLOWS, {});
  if (!follows[currentUserId]) follows[currentUserId] = [];
  const idx = follows[currentUserId].indexOf(targetId);
  if (idx > -1) follows[currentUserId].splice(idx, 1);
  else follows[currentUserId].push(targetId);
  save(CX.FOLLOWS, follows);
  return idx === -1;
}

export function isFollowing(targetId, currentUserId) {
  const follows = load(CX.FOLLOWS, {});
  return (follows[currentUserId] || []).includes(targetId);
}

// ── Discovery ──────────────────────────────────────────────────────────────

export function getSuggestedProfiles(currentUserId, limit = 4) {
  const follows = load(CX.FOLLOWS, {});
  const following = follows[currentUserId] || [];
  return getProfiles()
    .filter(p => p.uid !== currentUserId && !following.includes(p.uid))
    .sort((a, b) => b.followersCount - a.followersCount)
    .slice(0, limit);
}

export function getTrendingTags(limit = 8) {
  const tagCounts = {};
  getPosts().forEach(post =>
    (post.tags || []).forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; })
  );
  return Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

// ── Forum operations ───────────────────────────────────────────────────────

export function getThreads(communityId = null) {
  const threads = load(CX.FORUM, SEED_THREADS);
  if (communityId) return threads.filter(t => t.community === communityId);
  return threads;
}

export function voteThread(threadId, userId, direction) {
  const threads = load(CX.FORUM, SEED_THREADS);
  const thread = threads.find(t => t.id === threadId);
  if (!thread) return null;
  // Simplified: just increment for demo
  if (direction === 'up') thread.upvotes++;
  else if (direction === 'down') thread.downvotes++;
  save(CX.FORUM, threads);
  return thread;
}

// ── Funding operations ─────────────────────────────────────────────────────

export function getFundingRequests(filters = {}) {
  let results = [...SEED_FUNDING];
  if (filters.sector)    results = results.filter(f => f.sector.toLowerCase().includes(filters.sector.toLowerCase()));
  if (filters.stage)     results = results.filter(f => f.stage === filters.stage);
  if (filters.minScore)  results = results.filter(f => f.climateScore >= filters.minScore);
  return results.sort((a, b) => b.climateScore - a.climateScore);
}
