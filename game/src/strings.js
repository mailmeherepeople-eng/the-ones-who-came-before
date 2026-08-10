// EVERY user-visible string lives here (design doc §2.4 — Hindi swap later).
// Dates inside strings must come from constants.js via template functions where
// they vary; fixed textbook figures quoted verbatim are allowed here and are
// lint-protected (tools/lint-strings.mjs PROTECTED list).

export const S = {
  title: 'The Ones Who Came Before',
  subtitle: 'A journey through Timeline and Sources of History',
  studio: 'Git Gud Studio',
  startNew: 'Begin',
  resume: 'Continue your journey',
  newGameConfirm: 'Start over? Your whole story (your pot, your painting, your dig) will be erased.',
  newGameYes: 'Yes, start fresh',
  newGameNo: 'No, keep my story',

  openingCard: 'History is the study of the human past.',
  openingCard2: 'This is the story of how we know it.',

  ui: {
    interact: 'Tap to interact',
    interactKey: 'Press E to interact',
    continue: 'Continue',
    skip: 'Skip',
    done: 'Done',
    back: 'Back',
    zoomOutHint: 'Zoom out to rise into the sky',
    zoomInHint: 'Zoom in to return to the ground',
    joystickHint: 'Left: move · Right: look',
    desktopHint: 'WASD to move · mouse to look · E to interact · scroll to zoom',
    objective: 'To do',
    evidence: 'Evidence',
    sourceCards: 'Source Cards',
    loading: 'Shaping the valley…',
    settings: 'Settings',
    settingsTitle: 'Settings',
    close: 'Close',
    setLockCamera: 'Lock camera behind me',
    setLockCameraNote: 'The camera swings around to stay behind you as you walk, so you do not have to keep dragging. Dragging still works whenever you want it.',
    takeAim: 'Take Aim',
    fire: 'Fire',
    lowerBow: 'Lower bow',
    talk: 'Talk',
  },

  // Tab act-select menu (jump between acts without replaying; wipes progress)
  actMenu: {
    title: 'Jump to an act?',
    note: 'Jumping starts that act fresh (your current progress is replaced).',
    act1: 'Act One: LIVE',
    act2: 'Act Two: the Time Dial',
    act3: 'Act Three: DIG',
    cancel: 'Stay here',
    confirmTitle: 'Really start that act fresh? Everything you have done so far will be gone, and it cannot be brought back.',
    confirmYes: 'Yes, wipe it and jump',
    confirmNo: 'No, keep my progress',
  },

  // ---------- ACT 1 — LIVE ----------
  act1: {
    title: 'Act One: LIVE',
    sceneA_card: 'A valley, about 38,000 years ago.',
    sceneA_card2: 'You are one of the ones who came before.',

    wake: 'You wake in a rock shelter. Your tribe is stirring.',
    tribeNote: 'Your tribe. Six of you, together. Alone, the wild wins. Together, you eat.',

    obj_gather: 'Gather berries for the tribe (0/4)',
    obj_gather_n: (n) => `Gather berries for the tribe (${n}/4)`,
    gatherDone: 'Food gathered. Nothing is planted here. You take what the land gives.',
    huntersGatherers: 'Hunting animals. Gathering fruits and plants. That is the whole larder: hunters and gatherers.',

    // Pictogram speech. Act 1's tribe has a rich spoken language and NOT ONE
    // WORD of it survives, which is the whole point of the language beat, so
    // talking to a tribe member must never produce English. These are the
    // invented signs the elder uses; the editor can retune them per character.
    talkIcons: ['◈ ﬦ ◇', 'ᨐ ◈◈ ﬦ', '◇ᨏ ﬦ ◈', '◈ ᨏ ◇◇', 'ﬦ ◉ ᨐ', '◇ ﬦﬦ ◈'],
    talkPrompt: '💬',
    obj_hunt: 'Join the hunt by the plains',
    huntStart: 'A deer. Draw… hold… release when the aim steadies.',
    huntSuccess: 'The hunt succeeds. The tribe eats tonight.',
    huntMiss: 'It bolts. Steady the aim in the centre of the ring, then release.',
    predatorNear: 'Something watches from the tall grass. Stay close to the fire after dark.',
    predatorChase: 'RUN. It does not like the fire, get to camp!',
    predatorSafe: 'It turns away from the flames. The tribe pulls closer together.',

    obj_fish: 'Try the river. Tap when the float dips',
    fishCaught: 'A fish, silver and quick. The river feeds you too.',
    fishMissed: 'Too slow, the fish slips away. Watch for the dip.',

    obj_fire: 'Sit with the tribe at the fire',
    elderSpeaks: 'The elder speaks. You understand her. Every sound rich with meaning.',
    elderSpeech: '…',
    languageNote:
      'They had rich languages. Every one of them is lost. No recording, no writing, sound does not fossilise.',

    obj_knap: 'Shape a new blade at the knapping stone',
    knapIntro: 'Strike the core where it glints. Three good strikes: axe, blade, arrowhead.',
    knapStep: (n) => ['A clean flake. The axe edge is born.', 'Again. A long blade this time.', 'Small, sharp: an arrowhead.'][n],
    knapDone: 'Fire in the hearth. Better tools in the hand. The tribe is stronger this season.',
    knapFail: 'The strike glances off. Watch the glint and tap in rhythm.',

    obj_paint: 'Paint on the shelter wall',
    paintIntro:
      'Ochre, charcoal, and a bare wall. Paint what matters to you. Animals, hands, your own signs. It is yours.',
    paintDone: 'It dries into the rock. Remember this wall.',
    paintNote: 'In hundreds of caves across the world, they left paintings. Simple signs, whole hunts, open hands.',

    obj_shells: 'Collect shells by the river (0/3)',
    obj_shells_n: (n) => `Collect shells by the river (${n}/3)`,
    obj_drill: 'Drill the shells into beads at the knapping stone',
    drillIntro: 'Hold steady… the bow-drill bites the shell. Hold until it sings through.',
    drillDone: 'A string of shell beads. Small suns against the skin.',
    obj_trade: 'A strange tribe approaches. Meet them at the edge of camp.',
    tradeIntro:
      'They speak, you understand nothing. But they hold up dark glass-stone, and look at your beads.',
    tradeChoiceTitle: 'They wait. What do you do?',
    tradeOffer: 'Hold out the beads',
    tradeRefuse: 'Hold the beads close',
    tradeRefused: 'They shrug and turn. The elder nudges you. Perhaps their stone is worth more than pride.',
    tradeDone:
      'Beads for obsidian. No shared words, just open hands. Groups met, and things travelled.',

    depletion1: 'The berry bushes are bare. The herds have wandered beyond the ridge.',
    depletion2: 'The elder points past the horizon. It is time. It was always going to be time.',
    campMoves: 'Camp is packed in a morning. A temporary camp is a tool, not a home.',

    burial_card: 'That winter, the elder does not wake.',
    burial1: 'The tribe gathers. No one speaks your language of grief better than silence.',
    obj_burial_beads: 'Place her bead string in the grave',
    obj_burial_tool: 'Place her favourite blade beside her',
    burialNote: 'Perhaps they believed something continued.',
    burialDone: 'Stone over soil. The tribe stands a long time before moving on.',

    interstitial_generations: 'Generations pass. Your people continue.',

    // Scene B — Thaw
    sceneB_card: 'The cold ages are ending.',
    thawNote:
      'The last Ice Age lasted from over 100,000 years ago to around 12,000 years ago. Then the world warmed.',
    thawNote2: 'The ice melted. The waters swelled the rivers and drained into the oceans.',
    sceneB_ground: 'The valley is greener. The river runs wider and quicker than the old stories said.',

    // Scene C — Roots
    sceneC_card: 'By the river, your people stop walking.',
    obj_plant: 'Plant the wild grain by the river (0/4)',
    obj_plant_n: (n) => `Plant the wild grain by the river (${n}/4)`,
    plantIntro: 'Seeds kept from the wild harvest. Press them into the dark soil near the water.',
    plantDone: 'Green shoots, in rows, where you chose. Not found, grown.',
    riverNote: 'Near the river there is water to drink and to water the fields. And the soil is more fertile.',
    obj_pen: 'Lead the goats into the pen',
    penHint: 'Walk close and they will follow you. Lead them through the gate.',
    penDone: 'Goats in the pen, cattle by the post. The wild is becoming a herd.',
    settleNote: 'Cultivating grain. Domesticating animals. Settling down: this is how it began.',

    granaryIntro: 'Everything harvested goes to the community store. Everything.',
    granaryTake: 'A neighbour gently takes the sack from your hands and carries it to the store.',
    granaryQTitle: 'After the harvest, the store is full. Which grain sack is yours?',
    granaryQa: 'The biggest one',
    granaryQb: 'All of them',
    granaryQc: 'None of them',
    granaryQd: 'All of them, and none of them',
    granaryRight:
      'All of them, and none of them. The land was sowed together and harvested together. No one owned a private sack.',
    granaryWrong:
      'Look again. No sack has your name. The land was sowed together and harvested together: all of them, and none of them.',

    chiefIntro: 'The chieftain calls to you. Someone must carry water to the far field.',
    obj_chief_task: 'Carry the waterskin to the far field',
    chiefTaskDone: 'The field drinks. The chieftain nods. The work of the hamlet is shared work.',
    dispute_card: 'Two farmers argue over the edge of a field.',
    dispute1: 'Voices rise. The chieftain steps between them.',
    dispute2: 'She hears both. She walks the boundary. She marks it anew with stones, and both nod.',
    disputeNote: 'Chieftains carried the community: settling quarrels, sharing stores, watching over the well-being of all.',
    leanWeek:
      'The rains are late. The chieftain opens the store and shares the grain out, family by family, until the green returns.',

    // Scene D — Fire and Clay
    sceneD_card: 'Your hamlet has grown.',
    hamletGloss: 'Hamlet: a small settlement, a small village. Yours.',
    obj_pot: 'Shape a pot at the kiln',
    potIntro: 'Wet clay on the wheel of your palms. Choose a form, pull its curve, and press YOUR mark into it.',
    potShapes: ['Round-belly', 'Tall-neck', 'Wide-mouth'],
    potMarkPrompt: 'Press your mark into the wet clay. This mark is yours alone.',
    potFired: 'Out of the kiln: ringing hard, fire-red. Clay is soft; pottery is forever-ish.',
    obj_basket: 'Weave a reed basket',
    basketDone: 'A basket, quick work of an afternoon. Reeds are easy. Remember that.',
    obj_shelf: 'Place the pot and basket side by side in your hut',
    shelfDone: 'Side by side on the shelf. Clay and reed. Remember them both.',
    copperTrader:
      'A trader shows a bangle of strange, sun-coloured metal. The smith turns it over and over: copper.',
    copperNote: 'Copper first. Iron comes much later.',
    obj_delivery: 'Run the cart path: take grain to the neighbouring village, bring back cloth',
    deliveryThere: 'Grain handed over. Their weaver loads soft cloth in return.',
    deliveryDone:
      'Food out, cloth back. Villages trade what they have for what they need: food, clothing, tools.',
    networkNote: 'Paths become routes. Routes become networks. One village on the network is growing into a town.',
    act1End: 'Your pot. Your basket. Your wall. Your people.',
    act1End2: 'Remember where everything is.',

    // Community store + real bow hunt (equipment-loop rework; append-only)
    obj_store_basket: "Take a basket from the Community Chest",
    storeLesson: "The tribe's tools belong to everyone. Take what the task needs. Bring it back for the next hands.",
    obj_store_bow: "Take the bow from the Community Chest",
    obj_store_rod: "Take the fishing rod from the Community Chest",
    aimHint: 'Aim with the camera. Press E or tap to loose an arrow',
    obj_huntN: (n, total) => `Hunt deer for the tribe (${n}/${total})`,
    obj_meatN: (n, total) => `Pick up the meat (${n}/${total})`,
    obj_depositBerries: 'Put the berries in the store box',
    obj_depositMeat: 'Put the meat in the store box',
    obj_depositFish: 'Put the fish in the store box',
    depositBerriesDone: 'Into the box it goes. What one pair of hands gathers, the whole tribe eats.',
    depositMeatDone: 'Three animals, one box. Nobody here eats before the box is filled.',
    depositFishDone: 'The box takes the catch too. Everything found is everything shared.',

    obj_meat: 'Pick up the meat for the tribe',
  },

  // ---------- ACT 2 — PASS ----------
  act2: {
    title: 'Act Two: PASS',
    card: 'Rise. Watch time do what time does.',
    dialHint: 'Drag the dial to move through time',
    youMarker: 'YOUR PEOPLE',

    eras: {
      homoSapiens: 'Homo sapiens, for about 300,000 years',
      rockArt: 'First examples of rock art in the world',
      iceAge: 'Ice Age',
      iceAgeEnd: 'End of the last ice age',
      settlements: 'First settlements and beginning of agriculture',
      pottery: 'Pottery technology in the Indian Subcontinent',
      copper: 'Beginning of copper metallurgy',
      mesopotamia: "The world's first cities, in Mesopotamia",
      indus: 'Indus-Sarasvatī civilisation',
      buddha: 'Birth of the Buddha',
      ashoka: 'Aśhoka',
      jesus: 'Birth of Jesus',
      today: 'Today',
    },
    eraNote_iceAge: 'A time when the Earth was very cold, and much of it was covered in ice.',
    eraNote_era: 'Societies begin new eras at great events. The birth of an important person, the start of a reign.',

    p1_card: 'THE EROSION WINDOW',
    p1_intro: 'Your hut. Your shelf. Look underground, and scrub the centuries.',
    p1_basketGone: 'The basket is gone. Reed rots. Clay chips, but stays.',
    p1_grave: "The elder's grave: the beads and the blade keep their shape. Cloth and body return to soil and bone.",
    p1_note: 'Every object from the past is a piece of a jigsaw. Some pieces are gone forever.',

    p2_card: 'TWO DIRECTIONS FROM ONE POINT',
    p2_ce: 'Counted forward from the conventional year of the birth of Jesus: CE, the Common Era. It used to be written AD.',
    p2_bce: 'Counted backward from that same point: BCE, Before Common Era. It used to be written BC.',
    p2_challenge: 'Find the year ZERO on the dial. You have 30 seconds.',
    p2_trick: 'TRICK QUESTION.',
    p2_trickNote: 'There is no year zero. 1 BCE steps straight to 1 CE.',

    p3_card: 'THE GAP',
    p3_challenge: (buddha, today) =>
      `The Buddha was born around ${buddha}. How many years from then to ${today}? Count on the dial, 30 seconds. Make it, and the reward is yours.`,
    p3_answerLabel: 'years',
    p3_beat: 'You counted it, and you beat the clock. Now take the way that needs one breath instead of thirty seconds.',
    p3_slow: 'Counting works. Counting is slow. There is a faster way. And it is the reward.',
    p3_formula: 'Across the BCE/CE boundary: ADD both numbers, then SUBTRACT 1.',
    p3_bookExample:
      "The book's own example: suppose we are in the year 2024 CE. Then the Buddha, born in 560 BCE, was born 560 + 2024 − 1 = 2,583 years ago.",
    p3_practice: (a, b) => `Your turn, the fast way: from ${a} to ${b}?`,
    p3_correct: 'Correct. And in one breath, not thirty seconds.',
    p3_wrong: (ans) => `Add both, subtract one: ${ans}. Try the next one.`,

    p4_card: 'STEPS OF TIME',
    p4_decade: 'Dial locked to steps of 10 years. Ten years = a DECADE.',
    p4_century_cricket: '100 runs, a century. 100 years, also a century.',
    p4_centuryTask: 'Reach Aśhoka using century steps. Count your clicks.',
    p4_centuryNote: '21st century CE = 2001 to 2100. Centuries BCE count backwards from 1 BCE: the 3rd century BCE = 300 to 201 BCE.',
    p4_millennium: 'Dial locked to 1,000-year strides. A MILLENNIUM. 3rd millennium CE = 2001-3000; 1st millennium BCE = 1000-1 BCE.',
    p4_orderTask: 'Two flags, no labels. Which event happened first?',
    p4_orderNote: 'You did not need the dates. A timeline shows the ORDER of events all by itself.',

    p5_card: 'FACES OF THE CALENDAR',
    p5_gregorian:
      'The Gregorian calendar: 12 months, 365 days, a leap year every 4 years. Except century years, which must divide by 400. 1800 ✗ · 1900 ✗ · 2000 ✓.',
    p5_indian:
      'Many Indian calendars follow the positions of the sun and the moon. Their tables, the pañchānga, predict eclipses, sunrises and sunsets, and the dates of festivals.',
    p5_worldSame: 'Swap the face: the world beneath does not change. Only the counting does.',

    p6_card: 'ARRIVAL',
    p6_note: 'The village sleeps under grass now. A low mound by a river bend.',
    p6_flag: 'A survey flag goes into the turf.',

    deepTime_card: 'THE LONG BAR',
    deepTime_note:
      'Earth: 4.54 billion years. Primates: 10 million years ago. Fire: a million years ago. Homo sapiens: 300,000 years. Writing: 6,500 years. Our chapter is a sliver.',
    yearsAgoNote: (ya, bce) => `${ya} years ago, that is about ${bce}. Count back!`,
  },

  // ---------- ACT 3 — DIG ----------
  act3: {
    title: 'Act Three: DIG',
    card: 'The same valley. Present day. A team of five, and a mound with a story you already know.',
    specialists: {
      geologist: 'Geologist',
      palaeontologist: 'Palaeontologist',
      archaeologist: 'Archaeologist',
      anthropologist: 'Anthropologist',
      epigraphist: 'Epigraphist',
    },
    specialistBlurbs: {
      geologist: "Reads the Earth itself, soil, stones, hills, rivers. GEO = earth; -LOGIST = one who studies.",
      palaeontologist: 'Reads remains of plants, animals and humans from millions of years ago, fossils. PALAEO = ancient.',
      archaeologist: 'Digs up what people left: tools, pots, beads, bones and teeth, burnt grain, walls. ARCHAEO = the old.',
      anthropologist: 'Studies human societies and cultures, oldest times to today, by listening. ANTHROPO = human.',
      epigraphist: 'Reads ancient inscriptions. Writing cut into stone and metal.',
    },
    wrongSpecialist: {
      needArch: 'These are buried remains. My colleague with the trowel should recover these.',
      needPal: 'Impressions in rock, millions of years old… this calls for the fossil expert.',
      needAnth: 'These are living people with living memories. Let the one who listens do the talking.',
      needGeo: 'What ground is safe to open? Ask the one who reads the earth.',
      needEpi: 'Signs, maybe writing? That is inscription territory.',
    },
    obj_survey: 'Use the Geologist to survey the mound (ground vision)',
    groundVision: 'Ground vision: the old river course, the buried layers, and where digging is worthwhile.',
    geoNote: 'Deeper is older. The layers keep the order of time like pages keep the order of a story.',
    obj_dig: 'Excavate the marked squares with the Archaeologist',
    digLocked: 'Careful work. Finish the layer above before going deeper.',
    obj_fossil: 'Read the cliff fossils with the Palaeontologist',
    fossilNote:
      'Fossils: impressions of footprints, plants or animals, preserved within layers of soil or rock. From long before any hut stood here.',
    obj_talk: 'Interview the villagers with the Anthropologist',
    obj_epi: 'Show the marked potsherd to the Epigraphist',
    epiIntro: 'A mark, pressed on purpose. A picture… or a sign?',
    epiNote:
      'One mark alone cannot tell us. When marks form a system, they become writing. And writing is where the Epigraphist begins. Keep this sherd.',
    lanternHint: 'Dark in here. Raise the lantern.',
    paintingFound: 'On the wall, under the soot of ages. Exactly where you left it.',
    basketSlot: 'ORGANIC: NOT PRESERVED',
    basketSlotNote: 'A basket stood beside this pot. Reed rots. The slot stays empty, forever. Some jigsaw pieces are gone.',
    potFound: 'A pot. Chipped, fire-red… and carrying a mark you know.',
    flashback: 'You remember making this.',
    graveFound: 'A burial. Music down, hands gentle. Beads and a blade, laid with care.',
    graveNote: 'Grave goods. Perhaps a belief that something continued. That is our inference, read from what was placed here.',
    sourceCard: 'Source Card',
    sourceCategories: {
      archaeological: 'Archaeological',
      oral: 'Oral',
      artistic: 'Artistic',
      inscription: 'Inscriptions',
      literary: 'Literary (Indian)',
      foreign: 'Foreign accounts',
      scientific: 'Scientific',
    },
    sourceDef: 'A source of history: a place, person, text, or object from which we gather information about the past.',

    // Contradiction scene
    villagers: {
      grandmother: 'Ammamma',
      farmer: 'Raju the farmer',
      teacher: 'Miss Leela, retired teacher',
    },
    talk_gm1: 'Our elders always said: people lived on that mound before memory. They grew grain by the river.',
    talk_gm2: 'And a great king built a fort there! With walls of gold, they say.',
    talk_farmer1: 'Everyone knows a king ruled that mound. Old Mastanamma said so, and she knew everything.',
    talk_farmer_probe: 'Who told Mastanamma? …She heard it somewhere, I suppose. Everyone says it.',
    talk_teacher1: 'I read that settlements near rivers are older than kings. Grain first, thrones later.',
    talk_teacher2: 'A fort? I have seen no stone of it. But I would not swear either way.',
    talk_third1: 'A king with a golden fort. Mastanamma told my mother herself.',
    claimBoard: 'CLAIM BOARD',
    claims: {
      settled: 'People settled the mound and grew grain by the river',
      fort: "A great king built a fort on the mound",
      animals: 'The old ones painted on the shelter rock, and hunted the herds',
    },
    verdicts: { supported: 'SUPPORTED', contradicted: 'CONTRADICTED', cantTell: "CAN'T TELL" },
    claimHint_shared:
      'Raju and the third voice both trace to ONE storyteller. Two mouths, one origin. That is one source, not two.',
    claimResult_settled: 'Confirmed by the dig: grain, huts, hearths. Ammamma carried a true memory across ten thousand years.',
    claimResult_fort: 'No fort in any layer. Many voices said it. But they shared one origin. More voices is not more truth.',
    claimResult_animals: 'The painting, the bones, and the old stories agree. Different kinds of sources can confirm each other.',
    judgeNote:
      'Historians gather every source they can. Sources confirm, or contradict, and the historian must judge which to trust, with help from archaeologists, epigraphists, anthropologists, and experts of language.',
    detectiveNote: 'Yes. A historian works like a detective.',

    // Source Card content per find (title + what it tells us)
    cards: {
      soil: { title: 'The layers of the mound', tells: 'Soil, stones and the old river course, read by the Geologist. Deeper layers are older. The ground keeps time in order.' },
      pot: { title: 'A decorated pot', tells: 'Fired clay survives millennia. Its shape and its maker’s mark tell us about the technology and the hands of the village.' },
      potsherdMark: { title: 'The maker’s mark', tells: 'A deliberate sign pressed before firing. One mark is not writing. But signs in a system would be, and that is the Epigraphist’s work.' },
      basket: { title: 'A basket, missing', tells: 'Reed and cloth rot away. Organic things rarely survive. This piece of the jigsaw is gone forever.' },
      beads: { title: 'Drilled shell beads', tells: 'Ornaments of shell, drilled with stone tools. And exchanged between groups who shared no words.' },
      obsidian: { title: 'Obsidian from far away', tells: 'This dark glass-stone does not occur in the valley. It travelled here. Proof that groups met and exchanged.' },
      arrowheads: { title: 'Stone arrowheads', tells: 'Struck from a core near the old camp: improved tools (axes, blades, arrowheads) beside the remains of a fire.' },
      hearth: { title: 'Hearth charcoal', tells: 'A fire burned here, again and again. Charcoal keeps the memory. And the lab can read its age.' },
      grain: { title: 'Burnt grain', tells: 'Charred grains from the store: cereals were grown, harvested together, and kept in a shared granary.' },
      burial: { title: 'A careful burial', tells: 'Laid with a bead string and a favourite blade. Grave goods are our clue that they may have believed something continued.' },
      painting: { title: 'The shelter painting', tells: 'Pigment on sheltered rock survives. Paintings are an artistic source. A message with no words attached.' },
      fossil: { title: 'Fossils in the cliff', tells: 'Impressions of ancient life preserved in layers of rock, from long before humans, the Palaeontologist’s deep time.' },
      oralG: { title: 'Ammamma’s account', tells: 'Oral tradition: grain-growers by the river before memory. And a golden fort no one has seen.' },
      oralF: { title: 'Raju’s account', tells: 'Oral tradition: “everyone knows” there was a king. Traced back, it comes from a single storyteller.' },
      oralT: { title: 'Miss Leela’s account', tells: 'Oral + literary: cautious, partly right, and honest about what she does not know.' },
      labGrain: { title: 'Lab: grain analysis', tells: 'Species identified and a date range for the harvest. Chemistry reading a burnt seed.' },
      labCharcoal: { title: 'Lab: charcoal date', tells: 'The fire’s age, recovered from its own charcoal.' },
      labBone: { title: 'Lab: genetics', tells: 'This individual and the burial by the river were close kin. Genetics is history’s newest source.' },
    },

    // Lab
    lab: 'SEND TO LAB',
    labSlots: 3,
    lab_grain: 'Burnt grain → species identified, and a date range for the harvest.',
    lab_charcoal: 'Hearth charcoal → a date for the fire that made it.',
    lab_bone: 'Bone → genetics: this individual and the burial by the river were close kin.',
    labNote:
      'In the last fifty years or so, science has joined the dig: ancient climate studies, chemical analysis, the genetics of ancient people. History’s newest source.',
    recentNote:
      'For the last two or three centuries, history also arrives as newspapers. And in recent decades, as electronic media.',

    // report / satchel chrome
    findLayer: 'Find layer',
    noneYet: 'none here yet',
    recentMedia: '📰 newspapers · 📺 electronic media (recent centuries)',
    satchelTitle: 'EVIDENCE',
    eraLabels: {
      tribe: '👣 the tribe by the shelter',
      iceEnd: '🧊 end of the last ice age',
      settle: '🌾 settling and farming',
      pottery: '🏺 pottery',
      village: '🏘 the village (your pot!)',
      dig: '⛏ our excavation',
    },
    orderHintWrong: 'Look again: the left flag sits earlier on the line, earlier means first.',

    // Site report
    report: 'SITE REPORT',
    reportIntro: 'Compiled by the team. Written by everyone you have been.',
    reportWeFound: 'We found…',
    reportTimeline: 'Timeline of the site',
    reportSources: 'Where knowledge of the past comes from',
    reportEmpty: 'One slot in our inventory is empty, and will stay empty.',
    reportClosing: 'You just talked to yourself across ten thousand years.',
    reportClosing2: 'History is the study of the human past. You are now part of how it is studied.',
    exportReport: 'Save report as image',
    drillMore: 'Practice the gap formula',
    drillQ: (a, b) => `From ${a} to ${b}, how many years?`,
  },
};
