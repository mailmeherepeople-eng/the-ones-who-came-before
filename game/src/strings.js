// EVERY user-visible string lives here (design doc §2.4 — Hindi swap later).
// Dates inside strings must come from constants.js via template functions where
// they vary; fixed textbook figures quoted verbatim are allowed here and are
// lint-protected (tools/lint-strings.mjs PROTECTED list).

export const S = {
  onboarding: {
    title: 'Your first steps', progress: (n,total) => `${n} of ${total}`,
    skip: 'Skip practice', help: 'Show me', retry: 'Return to this step',
    helpTitle: 'Try it at your own pace', closeHelp: 'Let me try',
    complete: 'You did it!', selectTool: 'Choose a tool',
    equipAction: 'Equip', putAway: 'Put away', equipped: 'Equipped',
    jumpAction: 'Jump', takeBasket: 'Pick up the basket', basketNote: 'This basket belongs to your group. Take it with you to gather food, then return it to the shared tool chest.',
    equipNeeded: 'Your basket is put away. Press Q or tap Equip to hold it before picking berries.',
    equipNeededTouch: 'Your basket is put away. Tap Equip to hold it before picking berries.',
    wake: 'Sheltered stone above you. A little light reaches into the cave.',
    look: 'Look towards the circle of light.',
    lookKey: 'Move the mouse. If the view stays still, hold the mouse button and drag.',
    lookTouch: 'Drag across the world to look around.',
    forward: 'Walk into the circle of light.', forwardKey: 'Hold W or ↑ to walk forward. Release it to stop.',
    forwardTouch: 'Push the movement stick up. Let go to stop.',
    back: 'Take a few steps backwards.', backKey: 'Hold S or ↓.', backTouch: 'Pull the movement stick down.',
    left: 'Now take a few steps to the left.', leftKey: 'Hold A or ←.', leftTouch: 'Push the movement stick left.',
    right: 'And a few steps to the right.', rightKey: 'Hold D or →.', rightTouch: 'Push the movement stick right.',
    jump: 'Follow the light over the fallen rock.', jumpKey: 'Face the rock. Move forward and press Space to jump over it.',
    jumpTouch: 'Face the rock. Move forward and tap ↥ to jump over it.',
    basket: 'Borrow your group’s basket.', basketKey: 'Walk close to the basket. Press E or click its prompt to pick it up.',
    basketTouch: 'Walk close to the basket. Tap its prompt to pick it up.',
    equip: 'Carrying it is different from holding it.', equipKey: 'Press Q or click Equip. Watch the basket appear in your hand.',
    equipTouch: 'Tap Equip. Watch the basket appear in your hand.',
    stow: 'Try putting the basket away.', stowKey: 'Press Q again, or click Put away. You still carry the basket.',
    stowTouch: 'Tap Put away. You still carry the basket.',
    ready: 'Get your basket ready for gathering.', readyKey: 'Press Q or click Equip once more.', readyTouch: 'Tap Equip once more.',
    exit: 'Follow the daylight out of the cave.', exitKey: 'Look around the bend, then walk towards the light.',
    exitTouch: 'Look around the bend, then walk towards the light.',
    camp: 'Find your people by the fire.', campKey: 'Follow the golden light. You can look around and explore along the way.',
    campTouch: 'Follow the golden light. You can look around and explore along the way.',
    helpBody: 'Watch the control below, then try it yourself. There is no timer. If you have wandered away, return to this step for another try.',
    controls: 'Controls', controlsTitle: 'Make yourself at home',
    controlsBody: 'Move: WASD or arrow keys. Look: move the mouse, or hold and drag. Jump: Space. Interact: E or Enter. Equip or put away: Q. Adjust the camera distance: mouse wheel.',
    controlsTouch: 'Move with the movement stick. Drag the world to look. Tap ↥ to jump. Tap an object’s prompt to interact. Use Equip or Put away for your selected tool. Pinch the world to adjust the camera distance.',
    gatherReady: 'You already have a basket. Keep it equipped and follow the light to the berry bushes. Gather 12 berries, put them in the open food box for everyone, then return the basket to the tool chest.',
  },
  discoveries: {
    heading: 'A window into history', open: 'Explore this moment', close: 'Back to the valley',
    artNote: 'An illustration to help you imagine the past, not a photograph or an exact reconstruction.',
    reference: 'Dates follow the chapter timeline. Some are approximate; changes happened at different times in different places.',
    look: 'Look closer', reveal: 'Reveal the clue', found: 'Discovery added', again: 'In your collection',
    count: (n,total) => `${n} / ${total} discoveries`, next: 'Find an undiscovered moment',
    hint: 'Try another detail. There is no penalty for exploring.',
    entries: {
      rockArt: {title:'A message on stone', body:'Long before books, people made pictures on rock. Animals, hands and scenes can give us clues about their lives. We cannot always know exactly what a picture meant.', question:'Which part of this picture could survive long after its maker?', options:['Pigment on the rock','A voice in the cave'], answer:0, clue:'The painted rock can remain. The voice is gone unless someone records it.', alt:'An imagined rock shelter with handprints and an animal painted in ochre.'},
      iceAgeEnd: {title:'A changing world', body:'As the last ice age ended, climates and landscapes changed. Ice retreated in many places. People, plants and animals had to live with a changing world.', question:'Find the visual clue that ice is melting.', options:['A stone wall','Water flowing from the ice'], answer:1, clue:'The stream leads away from the ice. Landscapes change over long periods, not in a single day.', alt:'A glacier beneath mountains, with meltwater flowing into a green valley.'},
      settlements: {title:'Seeds change the day', body:'Growing plants and tending animals helped some communities settle in one place. Hunting and gathering also continued. Different communities followed different paths.', question:'What suggests that people plan to return to this place?', options:['Planted rows beside homes','A cloud passing overhead'], answer:0, clue:'Crops need care over time. Homes and fields suggest repeated use of a place.', alt:'Small homes beside rows of crops and a grain basket.'},
      pottery: {title:'Earth becomes a container', body:'Shape wet clay, let it dry and fire it: the result can hold food or water. A broken pot can survive in the ground and become a clue for an archaeologist.', question:'What would help a clay pot become hard and durable?', options:['Keeping it wet','Firing it with heat'], answer:1, clue:'Heat changes the clay. Fired clay can survive long after a reed basket decays.', alt:'A decorated clay pot and sherds beside a glowing firing area.'},
      mesopotamia: {title:'When a settlement becomes a city', body:'Some of the earliest cities grew in Mesopotamia. Many people lived close together, doing different kinds of work and exchanging goods. This is a wider-world landmark, not a claim about our valley.', question:'Which clue suggests many households living together?', options:['Groups of buildings and streets','One isolated tree'], answer:0, clue:'Buildings and streets show a settlement on a larger scale. Archaeologists need many kinds of evidence to understand life there.', alt:'An illustrative Mesopotamian city of mud-brick buildings beside a river.'},
      copper: {title:'A new material to shape', body:'People learned to work copper into useful objects. Stone tools did not disappear overnight. New and older materials could be used side by side.', question:'What is the new material shown beside the stone tool?', options:['Woven reed','Copper'], answer:1, clue:'The reddish metal is copper. A new technology does not mean everyone changes at once.', alt:'A reddish copper blade, copper pieces and a stone tool on a work surface.'},
      indus: {title:'Streets with a plan', body:'The Indus-Sarasvatī civilisation had cities, crafts and networks of exchange. Streets, bricks, drains and small objects help us investigate how people lived.', question:'Which feature helps you notice the layout of this city?', options:['Streets between rows of buildings','The colour of the sky'], answer:0, clue:'Follow the streets with your eyes. Layout is one clue; objects and other remains add more.', alt:'An illustrative brick-built city with intersecting streets and a covered drain.'},
      village: {title:'You were here', body:'This is the place you lived in. Your everyday objects will become evidence for someone in the future. Keep watching the same ground as homes weather and the land changes.', question:'What could a future archaeologist find here?', options:['Every thought you had','Pieces of your fired-clay pot'], answer:1, clue:'Objects can leave traces. Thoughts and feelings are much harder to recover from them.', alt:'An imagined small village with a pot, basket and hearth in the foreground.'},
      buddha: {title:'A life becomes a landmark', body:'The chapter places the birth of the Buddha around this date. Historians use important lives and events as reference points. This tree is a symbolic illustration, not a record of the birth.', question:'What does the word “around” tell us about this date?', options:['It is approximate','It happened every year'], answer:0, clue:'“Around” means the date is approximate. Historical dates do not all have the same level of certainty.', alt:'A symbolic leafy tree and an empty seat in a quiet landscape.'},
      ashoka: {title:'Words that last', body:'Aśhoka is remembered partly through inscriptions on rocks and pillars. Writing on a durable surface can carry a message far beyond the writer’s lifetime.', question:'Where would a carved message be most likely to last?', options:['On water','On stone'], answer:1, clue:'Stone can preserve writing. An epigraphist studies inscriptions to understand their messages.', alt:'An illustrative stone pillar and carved stone surface, without reproduced historical text.'},
      jesus: {title:'The calendar’s reference point', body:'CE and BCE use the conventional year of the birth of Jesus as their reference point. The timeline passes straight from 1 BCE to 1 CE. There is no year zero.', question:'Which label comes immediately before 1 CE?', options:['1 BCE','Year zero'], answer:0, clue:'One step connects 1 BCE and 1 CE. You will try that crossing yourself in the time bridge.', alt:'An illustrative ancient town beneath a starry sky, used as a symbolic calendar reference.'},
      today: {title:'Now you are the investigator', body:'You have watched the same ground change. Some things vanished; others left traces. Soon you will return to the ground and investigate what survived.', question:'Is a missing object proof that it never existed?', options:['Yes, every object survives','No, some materials decay'], answer:1, clue:'Absence needs careful thought. Reed and cloth may disappear while fired clay and stone survive.', alt:'A trowel, a potsherd, a field notebook and a survey flag at an excavation.'},
    },
  },
  timeLearning: {
    crossing: '1 BCE → 1 CE. One jump, no year zero.',
    formulaPieces: ['2', '+ 3', '− 1', '= 4 years'], sumLabel: 'Build the total years of travel',
    badge: 'TIME EXPLORER', next: 'Keep exploring', finish: 'Back to the timeline', check: 'Check my idea', help: 'Show me how',
    progress: (n,total) => `Stop ${n} of ${total}`, later: 'One year later →', jumps: n => `${n} ${n===1?'jump':'jumps'} made`,
    bridgeTitle: 'Walk across the calendar', bridgeIntro: 'Each stone is a year. Move one stone at a time and watch the labels. What happens when you leave 1 BCE?',
    bridgeFound: 'You crossed from 1 BCE straight to 1 CE. There is no year zero between them. Nice observation!',
    labelsTitle: 'Two names, the same date', labelsIntro: 'BCE means Before Common Era. CE means Common Era. You may also see BC and AD: BC labels the same years as BCE, and AD labels the same years as CE. These names are still used.',
    labelsNote: 'BC means Before Christ. AD comes from the Latin Anno Domini, meaning “in the year of the Lord”. This calendar uses the conventional year of the birth of Jesus as a reference. The labels change, but the past does not.',
    aliasQ: 'A museum label says 300 BC. Your time machine uses BCE. Which date takes you to the same year?', aliasOptions:['300 BCE','300 CE'],
    aliasWhy: 'BC and BCE are two labels for the same side of the timeline. Changing the letters does not move the year.',
    orderTitle: 'Which clue is older?', orderQ: 'One pot is dated 300 BCE. Another is dated 100 BCE. Which was made earlier?', orderOptions:['The pot from 100 BCE','The pot from 300 BCE'],
    orderWhy: 'On the BCE side, a larger number takes you farther back. Move toward CE and the numbers count down: 300, 200, 100...',
    retry: 'Good idea to test. Look at the clue below, then try again.', success:'You found it!',
    gapTitle:'Count the jumps, not the stones', gapIntro:'Travel from 2 BCE to 3 CE. Tap to make each one-year jump. Count how many jumps the journey takes.',
    gapFound:'Five labelled stones, but only four jumps! A time gap counts the jumps between dates, not the number of date labels.',
    formulaTitle:'Your shortcut across the bridge', formulaIntro:'Across BCE and CE, add the two numbers, then subtract one. That missing year zero is why simply adding would count one year too many.',
    formulaSmall:'2 + 3 − 1 = 4 years',
    buddhaTitle:'Try a longer journey together', buddhaIntro:'Imagine the destination is 2024 CE. We are travelling from the Buddha’s approximate birth date, 560 BCE. Take this in three small parts. There is no timer.',
    workedSteps:['From 560 BCE to 1 BCE: 559 years.','From 1 BCE to 1 CE: 1 year.','From 1 CE to 2024 CE: 2,023 years.'],
    workedTotal:'559 + 1 + 2,023 = 2,583 years. The shortcut gives the same answer: 560 + 2024 − 1 = 2,583.',
    revealStep:'Reveal the next part',
    practiceTitle:'Pilot your own crossing', practiceQ:'A traveller leaves 3 BCE and arrives in 2 CE. How many years pass?', practiceOptions:['4 years','5 years','6 years'], practiceWhy:'3 + 2 − 1 = 4. Try counting the jumps: 3 BCE → 2 BCE → 1 BCE → 1 CE → 2 CE.',
    sameTitle:'Stay on one side', sameQ:'Now travel from 6 BCE to 2 BCE. Both dates are BCE. How many years pass?', sameOptions:['7 years','4 years','8 years'], sameWhy:'On the same side, subtract the smaller number from the larger: 6 − 2 = 4. The add-and-subtract-one shortcut is only for crossing BCE to CE.',
    finalTitle:'One last journey, at your pace', finalQ:(a,b)=>`A clue comes from ${a}. Your destination is ${b}. How many years separate them?`, finalWhy:(a,b,n)=>`${a} + ${b} − 1 = ${n} years. Add the two date numbers, then remove one because there is no year zero.`, years:'Years of travel',
  },
  skyUI: {
    watchTitle: 'Watch time pass', play: 'Play time', rewind: 'Run time backward', forward: 'Run time forward',
    speedChoice: n => `${n}× speed`, directionRate: (n,back) => `${back ? 'Earlier' : 'Later'} · ${n} ${n === 1 ? 'year' : 'years'}/sec`,
    beneathSoil: 'BENEATH THE SOIL', soilCaption: 'Reed decays. Fired clay can survive.',
    compactIntro: 'Drag the ruler or select a landmark.', compactSteps: 'Use the arrows beside the year.',
    compactContext: 'Select a symbol on the ruler to visit a landmark.', compactReference: 'World history, beyond this imagined valley.',
    compactContextTitle: 'World history',
    compactTitles: {
      'a2.p1': 'What survives?', 'a2.deeptime': 'Deep time', 'a2.scrub': 'Follow the changes',
      'a2.p2': 'BCE and CE', 'a2.p3': 'Count the gap', 'a2.p4': 'Steps through time',
      'a2.p5': 'Calendars', 'a2.p6': 'Return to the ground',
    },
    eyebrow: 'ACT TWO · THE SAME PLACE', title: 'What will time leave behind?',
    intro: 'Drag the ruler left to move forward in time. Watch the homes change and the old village become buried.',
    hint: 'Give me a hint', hintText: 'Compare the basket with the fired-clay pot. Some materials decay; others may survive as evidence.',
    underground: 'Look underground', hideUnderground: 'Hide underground view', notebook: 'Field notebook',
    valleyNote: 'An imagined valley through generations.',
    phaseTitles: {
      'a2.p1': 'What will time leave behind?', 'a2.deeptime': 'How old is our world?',
      'a2.scrub': 'Follow the valley through time', 'a2.p2': 'Can you find year zero?',
      'a2.p3': 'How far apart are these dates?', 'a2.p4': 'Take bigger steps through time',
      'a2.p5': 'Different calendars, same world', 'a2.p6': 'Return to the same ground',
    },
    stepsIntro: 'Use the arrows beside the year. Watch the number below each arrow: it changes when the lesson asks you to take bigger steps.',
    phaseHints: {
      'a2.p2': 'Move carefully from 1 BCE to the next year. Read both labels.',
      'a2.p3': 'Compare the distance on each side of the BCE and CE boundary. Remember the missing year zero.',
      'a2.p4': 'Read the step size below each arrow. The left arrow moves to earlier years; the right arrow moves to later years.',
      'a2.p5': 'The same world can be described using different calendars. Watch what changes on the calendar face.',
      'a2.p6': 'Look for the mound where your village stood. Think about what might still be buried beneath it.',
    },
    observing: year => `OBSERVING · ${year}`, reference: year => `HISTORICAL REFERENCE · ${year}`,
    contextTitle: 'The same ground, another time', context: 'Follow the changes in the settlement. Select a timeline marker to read a historical reference.',
    referenceNote: 'A wider historical landmark. It does not mean this event happened in our imagined valley.',
    earlier: step => `${step} earlier`, later: step => `${step} later`, oneYear: '1 year',
    years: n => `${n} years`, selected: 'Date selected · click the year to edit',
    stepHint: n => `Use the arrows to take steps of ${n} years`,
    dragging: 'Release to settle on a year', moving: 'Time is passing · pause to choose a date',
    dateButton: year => `${year}. Enter an exact date`, watch: '▶ Watch time pass', pause: 'Ⅱ Pause time',
    speedTitle: 'TIME SPEED', speeds: ['Slow', 'Normal', 'Fast', 'Fastest'], rate: n => `${n} years per second`,
    dateTitle: 'GO TO AN EXACT YEAR', yearNumber: 'Year number', era: 'Era', bce: 'BCE', ce: 'CE', go: 'Go',
    noZero: 'BCE goes straight to CE. There is no year zero.', invalidYear: 'Enter a whole year greater than zero.',
    range: (a,b) => `Choose between ${a} and ${b}.`,
    gregorian: 'GREGORIAN FACE: 12 months · 365 days', indian: '☀️☾ INDIAN LUNI-SOLAR FACE: months follow the sun and moon',
    decade: 'DECADE', century: 'CENTURY', millennium: 'MILLENNIUM',
  },
  revision: {
    gatherIntro: 'Early people lived in bands that helped one another. Hunters and gatherers used tools for their work. Baskets helped carry gathered food. Your first task is to bring berries back for everyone.',
    gatherSteps: '1. Follow the golden light to the tool chest beside the fire. Open it and select a basket. 2. Close the chest and equip the basket using Q or the equipment button. Follow the light and gather 12 berries. 3. Put the berries in the open food box. 4. Return the basket to the chest.',
    needBasket: 'Take a basket from the tool chest before gathering berries.',
    gatherTake: 'Step 1 of 4: open the tool chest by the fire and take a basket',
    gatherPick: n => `Step 2 of 4: gather berries with your basket (${Math.min(n, 12)}/12)`,
    gatherStore: 'Step 3 of 4: open the food box beside the chest and put in your berries',
    gatherReturn: 'Step 4 of 4: return the basket to the tool chest',
    resume: text => `Welcome back. Your next task: ${text}`,
    saveFailed: 'Your story could not be saved on this device. Keep this page open and export your story from Settings.',
    exportSave: 'Export my story', importSave: 'Import a story',
    importConfirm: 'Replace this story with the selected saved story?',
    importFailed: 'This story could not be imported. Check the file and available device storage.',
    saveOK: 'Your story is saved on this device.',
    largeText: 'Larger text', largeTextNote: 'Enlarge instructions and reading panels.',
    gentleCamera: 'Gentle camera', gentleCameraNote: 'Turn off camera shake and running zoom.',
    assisted: 'Timing assistance', assistedNote: 'Wider timing targets and an option to complete a craft without timing.',
    sensitivity: 'Slower camera', sensitivityNote: 'Reduce mouse and touch look sensitivity.',
    assistAction: 'Complete this craft',
    autoAdvance: 'Advance spoken text automatically', autoAdvanceNote: 'Turn off to keep each narrated line until you press Continue.',
    practice: 'Recall a few things', practicePrompt: description => `Which idea fits this description? ${description}`,
    practiceEmpty: 'You have recalled every topic you have met. You can practise them again.',
    journal: 'Download field journal', journalTitle: 'My field journal', journalClaims: 'My conclusions',
    journalReview: 'Topics to revisit', journalKnown: 'Recalled successfully', journalPending: 'Ready to practise',
    sharedClaim: 'Several people repeating one original story proves that story is true.',
    sharedResult: 'These accounts share an origin. Repetition is not independent confirmation; compare other kinds of evidence.',
    exchangeClaim: 'People here exchanged goods with other groups.',
    resumeBoard: 'Return to the dig camp to continue examining the evidence',
    evidencePrompt: 'Inspect the source cards, select the evidence you used, then choose your verdict.',
    evidenceMissing: 'Select at least one source card to support your reasoning.',
    evidenceRetry: 'Read these sources again. Which ones directly address the claim?',
    beliefClaim: 'We know exactly what the buried person believed about death.',
    beliefResult: 'Grave goods suggest possible beliefs, but do not tell us exactly what a person believed. We cannot tell for certain.',
    evidenceInspect: 'Inspect evidence',
    prediction: 'Before moving time forward, which is more likely to survive in this ground?',
    predictionChoices: ['The fired clay pot', 'The reed basket', 'Both will stay unchanged'],
    predictionReveal: 'Compare your prediction with the cutaway. Reed has decayed; pieces of fired clay remain.',
    orderQuestion: 'Place these changes in order. Choose the earliest one still on the list.',
    orderOptions: ['Hunting and gathering', 'Settled farming', 'Pottery in this village'],
    orderWrong: 'Think back to your journey. You gathered food before settling, and the pottery village came later.',
    valleyNote: 'An imagined valley through generations. World-history markers give context; they do not mean those events happened here.',
    valleyPhases: ['Seasonal camps and moving herds', 'Families settle beside the river', 'Fields, pottery and neighbouring homes', 'Exchange routes connect settlements', 'The old homes fall silent; life moves nearby', 'New fields and paths surround the buried village', 'Travellers and markets keep the valley busy', 'Homes are rebuilt; orchards and routes spread', 'Later generations farm beside the old mound', 'A living valley, and a team uncovering its past'],
    dialLabel: 'Timeline. Use the left and right arrow keys or drag.',
    actMenu: 'Choose an act',
  },
  title: 'The Ones Who Came Before',
  subtitle: 'A journey through Timeline and Sources of History',
  studio: 'Git Gud Studio',
  startNew: 'Begin',
  resume: 'Continue your journey',
  newGameConfirm: 'Start over? Your whole story (your pot, your painting, your dig) will be erased.',
  newGameYes: 'Yes, start fresh',
  newGameNo: 'No, keep my story',

  // The opening used to be the NCERT definition of history, which is the least
  // game-like first line available and also a spoiler: the same sentence lands
  // with earned weight at act3.reportClosing2, after seventy minutes of
  // becoming true. It now appears once, at the end. What opens the game is the
  // promise instead, spoken to the student rather than about the subject.
  openingCard: 'Make a life here. Leave something behind.',
  openingCard2: 'One day, someone will uncover your story.',

  // First boot only, before the era card. The game is meant to replace an
  // evening with the textbook, and a student who does not know that will play
  // it like a cartoon and revise from the book anyway. So it says the method
  // out loud, once, in the game's own voice.
  howTo: {
    card1: 'Explore your history chapter by living, watching time pass, and uncovering the past.',
    card2: 'People here will ask you things. Answer from memory, never from notes. Being wrong costs you nothing at all.',
    card3: 'Your book fills in as you go. A faded page means you were told. A finished page means you knew.',
  },

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
    desktopHint: 'WASD to move · mouse to look · Space to jump · E to interact · Q to equip · scroll to zoom',
    objective: 'To do',
    evidence: 'Evidence',
    sourceCards: 'Source Cards',
    loading: 'Shaping the valley…',
    settings: 'Settings',
    settingsTitle: 'Settings',
    close: 'Close',
    setSound: 'Sound',
    setSoundNote: 'Narration, effects and the sounds of the valley. Turn this off and the game plays in silence.',
    setMusic: 'Music',
    setMusicNote: 'Background music only. Narration and effects keep playing.',
    setRich: 'Rich graphics',
    setRichNote: 'Moving shadows, cloud shadows and a film finish. Turn this off if the game stutters on your phone.',
    setLockCamera: 'Lock camera behind me',
    setLockCameraNote: 'The camera swings around to stay behind you as you walk, so you do not have to keep dragging. Dragging still works whenever you want it.',
    takeAim: 'Take Aim',
    fire: 'Fire',
    lowerBow: 'Lower bow',
    talk: 'Talk',
  },

  // Item display names (src/inventory.js holds the item table; the names live
  // here like every other user-visible string).
  items: {
    basket: 'Basket',
    bow: 'Bow and arrows',
    rod: 'Fishing rod',
    spear: 'Spear',
    waterskin: 'Waterskin',
    berry: 'Berries',
    meat: 'Meat',
    fish: 'Fish',
    firewood: 'Firewood',
  },

  // The community chest and store box panels
  container: {
    chestTitle: 'Community Chest',
    chestNote: 'The tools belong to everyone. Take what you need, bring it back when you are done.',
    storeTitle: 'Store Box',
    storeNote: 'Everything the band gathers goes in here, and everyone eats from it.',
    youTitle: 'You are carrying',
    empty: 'Nothing in here yet',
    carryNothing: 'Your hands are empty',
    takeHint: 'Tap a tool or a pile to move it',
    tools: 'Tools',
    food: 'Food',
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

    // The wake. Sound before sight, sight before words, and the player wakes
    // the character rather than the game waking it for them. `wake` is kept
    // because it is one of the six lines already recorded, but it now plays
    // over a body that is already standing rather than over a black screen.
    wake: 'You wake in a rock shelter. Your tribe is stirring.',
    wake_dark: 'Cold. Smoke. Somewhere close, a fire breathing.',
    wake_ceiling: 'Stone above you. Firelight moving across it.',
    wake_riseTap: 'Tap to rise',
    wake_riseKey: 'Press any key to rise',
    wake_stand: 'Your people are already up.',
    // tribeNote MOVED. It used to fire over an empty wake, describing a tribe
    // the player had not met; it now lands at the fire, with all six of them
    // physically around you.
    tribeNote: 'Your tribe. Six of you, together. Alone, the wild wins. Together, you eat.',

    // Hunger before basket. The old order taught storeLesson (shared tools)
    // before the player had touched a berry, so the game's first act was to
    // explain a solution to a problem nobody had felt. Now the hands fail
    // first, and the basket is the answer.
    hunger: 'Your stomach speaks first. It has been speaking since before you woke.',
    // The objective line is a To-do list, so it takes the instruction; the
    // description rides alongside as a toast instead of pretending to be one.
    obj_bare: 'Find something to eat',
    berryBare1: 'Berries, dark and heavy on the bush. You pick with bare hands.',
    pickBare: 'Pick with bare hands',
    berrySpill: 'Two handfuls, and no more hands. The rest drop back into the thorns.',
    berryWant: 'Across the camp, a gatherer walks out swinging an empty basket.',

    obj_gather: 'Gather berries for the tribe',
    obj_gather_n: (n) => `Gather berries for the tribe (${n} picked)`,
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

    // Borrowed tools: the chest lends, the store box receives, and every tool
    // has to go back. The lesson used to be one narrator line (storeLesson);
    // these are the objectives that make it a rule you have to obey.
    openChest: 'Open the Community Chest',
    openStore: 'Open the store box',
    pickBerry: 'Pick berries',
    takeMeat: 'Take the meat',
    castLine: 'Cast a line',

    // Interact labels. The prompt used to be a bare emoji and the player had to
    // guess the verb; these name the action, as in the reference screenshot.
    lbl_knap: 'Knap a blade',
    lbl_paint: 'Paint the wall',
    lbl_drill: 'Drill the shells',
    lbl_shell: 'Collect shell',
    lbl_trade: 'Trade with the visitors',
    lbl_graveBeads: 'Lay the beads',
    lbl_graveBlade: 'Lay the blade',
    lbl_plant: 'Plant the seed',
    lbl_waterskin: 'Take the waterskin',
    lbl_farfield: 'Water the far field',
    lbl_kiln: 'Use the kiln',
    lbl_reeds: 'Cut reeds',
    lbl_shelf: 'Set them on the shelf',
    lbl_sack: 'Pick up the sack',
    lbl_neigh: 'Give the cloth',
    lbl_home: 'Head home',
    obj_returnBasket: 'Put the basket back in the Community Chest',
    returnBasketDone: 'The basket goes back on the pile. Someone else will need it before the day is out.',
    obj_returnRod: 'Put the fishing rod back in the Community Chest',
    returnRodDone: "The rod goes back. Nothing here belongs to one person.",

    // The second hunt, which is a ruse: it exists to walk the player out to
    // the plains, still carrying the bow, so the bear can appear far from camp.
    moreMeat: 'One day of food is not a winter. The tribe asks you to go back out for more.',
    obj_huntMore: 'Return to the plains and hunt for more meat',
    obj_returnBow: 'Put the bow back in the Community Chest',
    returnBowDone: 'You are still shaking, and you still hand it over. It was never yours to keep.',
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
    p2_ce: 'CE means Common Era. AD is another label for the same years. Both use the conventional year of the birth of Jesus as their reference point.',
    p2_bce: 'BCE means Before Common Era. BC is another label for these same years. As you move toward CE, BCE numbers get smaller. A bigger BCE number is farther back in time.',
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
      "Imagine travelling from the Buddha’s approximate birth date, 560 BCE, to 2024 CE: 560 + 2024 − 1 = 2,583 years. Add the dates, then remove one because there is no year zero.",
    p3_practice: (a, b) => `Your turn, the fast way: from ${a} to ${b}?`,
    p3_correct: 'You found the gap! You can check it by imagining the jumps between the dates.',
    p3_wrong: (ans) => `Let us check it together. Add the two date numbers, then subtract one for the missing year zero. The journey takes ${ans} years.`,

    p4_card: 'STEPS OF TIME',
    p4_decade: 'Try three taps on the arrows beside the year. Each tap now travels 10 years. That is one decade! Watch how far each jump takes you.',
    p4_century_cricket: '100 runs, a century. 100 years, also a century.',
    p4_centuryTask: 'Jump backward in centuries until you pass Aśhoka. Count your taps.',
    p4_centuryNote: 'A century is a group of 100 years. The first century CE runs from 1 to 100. The next starts at 101. Follow that pattern: the 21st century CE runs from 2001 to 2100.',
    p4_centuryBCE: 'On the BCE side, count the groups backward from 1 BCE. The first is 100 to 1 BCE, the second is 200 to 101 BCE, and the third is 300 to 201 BCE.',
    p4_centuryQuestion: 'A museum drawer holds objects from the 3rd century BCE. Which date belongs in it?',
    p4_centuryOptions: ['250 BCE','150 BCE'],
    p4_centuryFeedback: 'The drawer covers 300 to 201 BCE. The year 250 BCE fits inside it. The year 150 BCE belongs to the 2nd century BCE.',
    p4_millennium: 'Those were giant jumps! Each was 1,000 years: one millennium. The first millennium CE covers 1 to 1000. The third covers 2001 to 3000. On the BCE side, the first covers 1000 to 1 BCE.',
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
    // The narrator has been a person the whole time. One line, played once, and
    // every "Note" line in the game retroactively stops being textbook voice
    // and becomes her field notes. Nothing else has to be rewritten for it.
    epiReveal: 'You have been hearing my voice this whole time. I read marks for a living. I have been reading yours.',
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

  // ---------- CODEX: the terms, kept ----------
  // Structure (which entry belongs to which act and syllabus item) is in
  // src/codex.js; the words are here, like every other user-visible string.
  // `tells` is written to be READ TWICE: once when the term is met, and again
  // as the restatement after the player retrieves it. So it has to be the
  // exam's phrasing and not a poetic gloss on it.
  codex: {
    band: {
      term: 'Band',
      tells: 'A small group who live and move together. Six of you. Alone the wild wins, together you eat.',
    },
    huntGather: {
      term: 'Hunters and gatherers',
      tells: 'People who hunt animals and gather fruits, roots and plants. Nothing is planted. You take what the land gives.',
    },
    camp: {
      term: 'Temporary camp',
      tells: 'Hunters and gatherers move as the food moves, sheltering in caves and rock shelters. A camp is a tool, not a home.',
    },
    lostTongues: {
      term: 'Lost languages',
      tells: 'They spoke rich languages and every one is gone. Sound does not fossilise, and nobody had writing yet.',
    },
    toolmaking: {
      term: 'Fire and stone tools',
      tells: 'They controlled fire, and struck stone into better axes, blades and arrowheads.',
    },
    graveGoods: {
      term: 'Grave goods',
      tells: 'The dead were buried with the beads and blades they had used. That is our clue that they may have believed something continued.',
    },
    rockArt: {
      term: 'Rock paintings',
      tells: 'In hundreds of caves across the world they painted animals, whole hunts, and open hands on sheltered rock.',
    },
    exchange: {
      term: 'Ornaments and exchange',
      tells: 'Shell beads, drilled with stone tools. Groups who shared no words still met and exchanged what they had.',
    },
    iceAge: {
      term: 'The last Ice Age',
      tells: 'The Earth was very cold and much of it lay under ice. The last one ran from over 100,000 years ago to about 12,000 years ago.',
    },
    thaw: {
      term: 'The thaw',
      tells: 'The ice melted. The water swelled the rivers and drained into the oceans.',
    },
    farming: {
      term: 'Settling down',
      tells: 'Cultivating grain. Domesticating animals. People stopped walking and stayed.',
    },
    riverside: {
      term: 'Why by a river',
      tells: 'Water to drink and water for the fields. And the soil near a river is more fertile.',
    },
    chieftain: {
      term: 'Chieftain',
      tells: 'She settles quarrels, shares out the store, and watches over the well-being of everyone in the settlement.',
    },
    shared: {
      term: 'Nobody owned a sack',
      tells: 'The land was sowed together and harvested together. Everything went to the community store. No one held a private share.',
    },
    village: {
      term: 'Hamlets into villages',
      tells: 'Settlements grew, and traded what they had for what they needed: food, clothing and tools.',
    },
    network: {
      term: 'Networks',
      tells: 'Paths become routes, routes become networks, and a village on the network grows into a town.',
    },
    pottery: {
      term: 'Pottery and copper',
      tells: 'Fired clay rings hard and lasts for millennia. Copper is the first metal worked here. Iron comes much later.',
    },
    hamlet: {
      term: 'Hamlet',
      tells: 'A small settlement. A small village.',
    },
  },

  // The 📖 panel chrome. Tone rule: a pending page is NOT a failure. The game
  // simply has not asked yet, and the wording must never let it read as a mark
  // against the player halfway through act 1.
  codexUI: {
    title: 'What you know',
    blurb: 'A faded page means you were told it. A finished page means you said it back.',
    known: 'you knew it',
    pending: 'not yet said back',
    empty: 'Nothing in here yet. Keep going.',
    added: (term) => `📖 ${term}, added to your book`,
    firstHint: 'Tap the book at the top right to read anything again',
  },

  // ---------- RECALL: retrieval, in fiction ----------
  // Nobody in the game says "quiz". Every question is something a person in
  // the world would plausibly ask, and the wrong options are wrong the way a
  // real misunderstanding is wrong, not obviously silly. See src/recall.js.
  recall: {
    again: 'One more, from a while back:',
    notQuite: 'Not quite. It is this:',
    q: {
      band: {
        question: 'A child asks why the band keeps every tool in one chest. What do you tell her?',
        options: [
          'The tools belong to all of us. Take what the work needs, bring it back.',
          'The strongest hunter owns them and lends them out.',
          'They are the elder’s. She decides who may touch them.',
        ],
        answer: 0,
      },
      huntGather: {
        question: 'The visitors point at your camp, then at the ground, asking with their hands. How do your people eat?',
        options: [
          'We hunt the animals and gather what grows. Nothing here is planted.',
          'We sow grain in rows and wait for the harvest.',
          'We keep herds in a pen and live on their milk.',
        ],
        answer: 0,
      },
      lostTongues: {
        question: 'A child asks what the old ones at the shelter sounded like. What can you honestly say?',
        options: [
          'Nobody knows. They spoke richly, and not one word of it survives.',
          'They had no language yet, only signs and gestures.',
          'Their words are painted on the shelter wall, if you can read them.',
        ],
        answer: 0,
      },
      farming: {
        question: 'A trader from a walking band asks how your village came to stand still. What changed?',
        options: [
          'We began to grow grain and to keep animals. So we stayed.',
          'The hunting here got better, so we stopped moving.',
          'A chieftain ordered us to build huts and remain.',
        ],
        answer: 0,
      },
    },
  },

  // ---------- SYLLABUS LABELS (teacher-facing) ----------
  // One line per examinable item in game/COVERAGE.md. These render in the codex
  // and in the ?data results table, so they are user-visible and belong here.
  // Every taught item has a teacher-facing label.
  syllabus: {
    '4.1': 'History is the study of the human past',
    '4.2': 'Geologists read the earth',
    '4.3': 'Palaeontologists read fossils',
    '4.4': 'Anthropologists study societies and cultures',
    '4.5': 'Archaeologists dig up what people left',
    '4.6': 'Epigraphists read inscriptions',
    '4.7': 'Fossils are impressions preserved in rock layers',
    '4.8': 'Eras begin at great events',
    '4.9': 'The Gregorian calendar worldwide; India has many others',
    '4.10': 'Gregorian: 12 months, 365 days, leap years, the 400 rule',
    '4.11': 'CE and AD label the same years',
    '4.12': 'BCE and BC label the same years before CE',
    '4.13': 'There is no year zero',
    '4.14': 'Across the boundary: add both, then subtract one',
    '4.15': 'A journey from 560 BCE to 2024 CE takes 2,583 years',
    '4.16': 'A decade is ten years',
    '4.17': 'A century; the 21st century CE is 2001 to 2100',
    '4.18': 'The 3rd century BCE is 300 to 201 BCE',
    '4.19': 'A millennium is a thousand years',
    '4.21': 'A timeline shows order even without dates',
    '4.22': 'The pañchānga',
    '4.23': 'Indian calendars follow the sun and the moon',
    '4.24': 'What counts as a source of history',
    '4.25': 'The categories of sources',
    '4.26': 'The past is a jigsaw with pieces missing',
    '4.27': 'Sources confirm or contradict, and the historian judges',
    '4.28': 'Who helps a historian',
    '4.29': 'Science as a source: climate, chemistry, genetics',
    '4.30': 'Newspapers and electronic media',
    '4.31': 'Homo sapiens, for about 300,000 years',
    '4.32': 'Bands and groups help each other',
    '4.33': 'Hunters and gatherers',
    '4.34': 'Temporary camps, rock shelters and caves',
    '4.35': 'Their languages are lost',
    '4.36': 'Fire, and better axes, blades and arrowheads',
    '4.37': 'Grave goods, and belief',
    '4.38': 'Rock paintings',
    '4.39': 'Ornaments, and exchange between groups',
    '4.40': 'What an Ice Age is',
    '4.41': 'The last Ice Age, and when it ended',
    '4.42': 'Melting ice swelled the rivers and the oceans',
    '4.43': 'Settling down: cultivating and domesticating',
    '4.44': 'Settling near rivers: water and fertile soil',
    '4.45': 'Chieftains and the well-being of all',
    '4.46': 'No private ownership: sowing and harvesting together',
    '4.47': 'Hamlets grow into villages that exchange goods',
    '4.48': 'Routes become networks, villages become towns',
    '4.49': 'Pottery, and copper before iron',
    '4.50': 'A hamlet is a small settlement',
  },

  // ---------- TEACHER SURFACES (?data and ?pilot) ----------
  // Never reachable from the title screen, and never shown to a student.
  results: {
    title: 'SESSION DATA',
    blurb: 'One row per child on this device. Nothing here has left this browser.',
    colStudent: 'Student',
    colTaught: 'Covered',
    colAsked: 'Asked',
    colRetrieved: 'Recalled',
    colMinutes: 'Minutes',
    colReached: 'Reached',
    anon: 'this device',
    caveat: 'Covered means the game taught it. Asked means the game made the child produce it from memory. A low Asked count is a gap in the game, not in the child.',
    downloadCsv: 'Download CSV',
    downloadJson: 'Download JSON',
  },

  pilot: {
    title: 'Who is playing?',
    note: 'For classroom use. Each name keeps its own separate save on this device.',
    start: 'Start',
  },
};

// Later-act notebook entries reuse the exact explanations taught on screen.
Object.assign(S.codex, {
  '4.1': {term:'History', tells:S.act3.reportClosing2},
  '4.2': {term:'Geologist', tells:S.act3.specialistBlurbs.geologist},
  '4.3': {term:'Palaeontologist', tells:S.act3.specialistBlurbs.palaeontologist},
  '4.4': {term:'Anthropologist', tells:S.act3.specialistBlurbs.anthropologist},
  '4.5': {term:'Archaeologist', tells:S.act3.specialistBlurbs.archaeologist},
  '4.6': {term:'Epigraphist', tells:S.act3.specialistBlurbs.epigraphist},
  '4.7': {term:'Fossils', tells:S.act3.fossilNote},
  '4.8': {term:'Eras', tells:S.act2.eraNote_era},
  '4.9': {term:'Different calendars', tells:S.act2.p5_worldSame + ' ' + S.act2.p5_indian},
  '4.10': {term:'Gregorian calendar', tells:S.act2.p5_gregorian},
  '4.11': {term:'Common Era', tells:S.act2.p2_ce},
  '4.12': {term:'Before Common Era', tells:S.act2.p2_bce},
  '4.13': {term:'The missing year zero', tells:S.act2.p2_trickNote},
  '4.14': {term:'Counting across BCE and CE', tells:S.act2.p3_formula},
  '4.15': {term:'The worked example', tells:S.act2.p3_bookExample},
  '4.16': {term:'Decade', tells:S.act2.p4_decade},
  '4.17': {term:'Centuries CE', tells:S.act2.p4_centuryNote},
  '4.18': {term:'Centuries BCE', tells:'The 3rd century BCE runs from 300 to 201 BCE, counting backwards towards 1 BCE.'},
  '4.19': {term:'Millennium', tells:S.act2.p4_millennium},
  '4.21': {term:'Order on a timeline', tells:S.act2.p4_orderNote},
  '4.22': {term:'Pañchānga', tells:S.act2.p5_indian},
  '4.23': {term:'Sun and moon calendars', tells:S.act2.p5_indian},
  '4.24': {term:'Historical sources', tells:S.act3.sourceDef},
  '4.25': {term:'Kinds of sources', tells:'Objects, oral accounts, art, inscriptions, literature, foreign accounts and scientific evidence offer different clues about the past.'},
  '4.26': {term:'Preservation and missing evidence', tells:S.act2.p1_note + ' ' + S.act2.p1_basketGone},
  '4.27': {term:'Judging evidence', tells:S.act3.judgeNote},
  '4.28': {term:'A team of specialists', tells:'Historians work with geologists, palaeontologists, archaeologists, anthropologists and epigraphists to interpret different evidence.'},
  '4.29': {term:'Science as a source', tells:S.act3.labNote},
  '4.30': {term:'Recent sources', tells:S.act3.recentNote},
  '4.31': {term:'Humanity in deep time', tells:S.act2.deepTime_note},
  '4.40': {term:'Ice Age', tells:S.act2.eraNote_iceAge},
});
S.reviewQuestions = {
  '4.11': {question:'Two museum labels say 300 CE and AD 300. What should you tell a friend?',options:['They mean the same year','They are 300 years apart','One must be a mistake'],answer:0},
  '4.12': {question:'A pot comes from 300 BCE and a bead from 100 BCE. Which takes you farther into the past?',options:['The pot','The bead','Both dates mean the same year'],answer:0},
  '4.13': {question:'Your time machine is at 1 BCE. Move one year forward. Where do you land?', options:['1 CE','0','2 BCE'],answer:0},
  '4.14': {question:'Your journey crosses from BCE to CE. Which shortcut counts the years correctly?',options:['Add their numbers, then subtract one','Add their numbers, then add one','Subtract the smaller number from the larger'],answer:0},
  '4.16': {question:'A family remembers ten years of harvests. What span is that?',options:['A decade','A century','A millennium'],answer:0},
  '4.26': {question:'You find pottery but no reed baskets. What can you conclude?',options:['Reed may have decayed; absence does not prove baskets were never used','Nobody here made baskets','Every object survives equally well'],answer:0},
  '4.2': {question:'Who would you ask to interpret the soil layers before digging?',options:['A geologist','An epigraphist','An anthropologist'],answer:0},
  '4.3': {question:'Who studies the deep-time fossil impressions in the cliff?',options:['A palaeontologist','An epigraphist','An anthropologist'],answer:0},
  '4.5': {question:'Who should recover pottery and burnt grain from a settlement?',options:['An archaeologist','An epigraphist','A palaeontologist studying deep-time fossils'],answer:0},
  '4.6': {question:'Who examines writing cut into stone or metal?',options:['An epigraphist','A geologist','An anthropologist'],answer:0},
  '4.27': {question:'Three people repeat a story learned from the same person. What should you do?',options:['Check it against independent evidence','Count it as three independent confirmations','Assume oral accounts are always false'],answer:0},
};

S.textbook = {
  title: 'Chapter practice notebook',
  intro: 'Timeline and Sources of History: practise the date exercises, inspect different sources, and plan your own investigation. Your notes stay in this story on this device and are included in your downloaded journal.',
  millennia: 'A millennium lasts 1,000 years. Its plural can be millenniums or millennia. Both are correct.',
  roles: 'A picture is a reconstruction, not proof of fixed roles. Women may have painted and men may have cooked or cared for children. Our evidence is limited, and work could differ between communities.',
  rolesQuestion: 'A reconstruction shows a woman cooking. What can we safely conclude?',
  rolesOptions: ['It illustrates one possible scene; it does not prove only women cooked', 'Only women cooked in every early community', 'Men never cared for children'],
  deepLabels: ['Earth', 'Atmospheric oxygen', 'Primates', 'Fire', 'Homo sapiens', 'Writing'],
  deepStages: 'Figure 4.1 also shows cells and bacteria; sponges, fungi and corals; insects, fish and sharks; amphibians and reptiles; dinosaurs, birds and mammals; flowers and bees. They illustrate the long development of life. This compressed, logarithmic strip does not give every stage an exact date or use equal spacing for equal time.',
  calendarDetail: 'A pañchānga lists days and astronomical information, including eclipses and sunrise and sunset times. It can also give festival timings and weather predictions. Auspicious means favourable or thought to bring good luck.',
  glossary: 'A historian studies and writes about the past. Genetics studies how characteristics pass between generations. Welfare means health, prosperity and well-being. An era is a distinct period of time. Afterlife means a life believed to begin after death.',
  sourceTitle: 'The source map',
  sourceIntro: 'Use a variety of sources and compare what they can and cannot tell you. The textbook does not ask you to memorise every example.',
  sourceGroups: [
    ['Archaeological sources', 'Structures such as monuments and mounds; excavated human, animal and plant remains; tools, weapons, figurines, ornaments, pottery, toys, habitations and burials.'],
    ['Inscriptions', 'Writing on objects such as coins and copper plates, alongside written records and manuscripts in the chapter source map. An epigraphist studies ancient inscriptions.'],
    ['Oral sources', 'Genealogies (accounts of descent) and folklore. A remembered story can offer evidence, but several retellings can share one source.'],
    ['Literary sources', 'Indian literature includes Vedas and Itihasas, poems, plays, historical texts, stories, and scientific or technological texts. Foreign accounts include travelogues and chronicles.'],
    ['Artistic sources', 'Paintings, sculptures and carved panels. Look carefully at what is visible before inferring who made it or what it means.'],
    ['Science and recent sources', 'Ancient climate, chemistry and genetics add evidence. For recent history, consult newspapers and electronic media, comparing their origin and reliability.'],
  ],
  dateTitle: 'Date workshop',
  dateIntro: 'The worked questions below use 2024 CE when they say years ago, matching the textbook example. A different reference year changes the answer.',
  orderPrompt: 'Choose the earliest date still on the timeline list.',
  orderHint: 'For BCE, larger numbers are earlier. All BCE dates come before CE dates; CE numbers then increase.',
  orderDone: 'Your dates are in chronological order.',
  centuryQ: year => `Which century includes ${year}? Enter the century number.`,
  gapQ: (a,b) => `How many years passed from ${a} to ${b}?`,
  agoQ: (n,y) => `Using ${y} as the reference, what BCE year was ${n.toLocaleString('en-IN')} years earlier? Enter the BCE number.`,
  millenniumQ: 'What BCE year begins the 8th millennium BCE? Enter the BCE number.',
  centuryStartQ: 'What CE year begins the 20th century?',
  centuryEndQ: 'What CE year ends the 20th century?',
  check: 'Check answer', correct: 'Correct. Your reasoning fits the timeline.',
  wrong: answer => `Try again. The answer is ${answer}. Review the explanation, then enter it.`,
  centuryReason: 'Count centuries from year 1: years 1 to 100 form the first century. For BCE, the 3rd century runs from 300 to 201 BCE.',
  gapReason: 'Across BCE and CE, add the two numbers and subtract one because there is no year zero. Within CE, subtract the earlier year from the later year.',
  agoReason: 'Across the boundary, BCE number + CE number - 1 = elapsed years. Rearrange to find the BCE number.',
  millenniumReason: 'The 1st millennium BCE runs from 1000 to 1 BCE. The 8th runs from 8000 to 7001 BCE.',
  projectsTitle: 'Your own investigation',
  projectsIntro: 'Use a family, a local community, or an invented example. You can use initials and leave personal details out. These are open investigations, not automatically graded answers.',
  projects: [
    ['memories', 'Past and present', 'Describe an early memory and roughly how old you were. Explain one way understanding the past helps explain life today.'],
    ['family', 'Three generations and their sources', 'Make a family tree or a community history. Where possible, include both sides and three generations. For each person, note their relation, name or initials, occupation, birthplace, and source of that information. Compare memories with photographs, diaries or documents; mark anything uncertain.'],
    ['timeline', 'Your own timeline', 'Create a timeline from 1900 CE to the current year with births or local events. Mark the start and end of the 20th century, and record the reference year you used.'],
    ['objects', 'Look, then infer', 'Choose an old object, coin, building, picture or carved panel. List what you can directly see, what you infer, and what you still cannot tell. Describe activities visible in the game\u2019s camp and farming village. Explain why the people\u2019s roles are possibilities, not rules for everyone.'],
    ['detective', 'Historians and detectives', 'Explain why a historian can be compared to a detective. Use two sources from your dig, explain whether they agree, and identify a missing piece of evidence.'],
    ['museum', 'Plan a museum visit', 'Research a nearby museum and its exhibits with your teacher. Plan questions, keep notes during a visit, then write what was surprising, interesting or enjoyable. The game\u2019s source cards can be used for a practice report.'],
    ['interview', 'Meet a historian or archaeologist', 'With your teacher, plan a school talk with a historian or archaeologist. Prepare questions about your region, their evidence, and why local history matters. Record what you learn and identify your source.'],
    ['resilience', 'How communities changed', 'Explain how food, cooperation, new tools and exchange helped settlements grow. Early people faced serious challenges; our survival depended on their persistence. What evidence in your journey supports your explanation?'],
  ],
  notesSaved: 'Notes saved in this story.',
};
S.syllabus['4.51'] = 'Interpret reconstructed gender roles cautiously';
S.syllabus['4.20'] = 'Millenniums and millennia are both correct';
S.codex['4.20'] = {term:'Millenniums or millennia', tells:S.textbook.millennia};
S.codex['4.51'] = {term:'Reconstruction and roles', tells:S.textbook.roles};
S.codex['4.28'].tells += ' Experts in literature and languages also help interpret sources.';
S.reviewQuestions['4.20'] = {question:'Which plural of millennium is correct?',options:['Both millenniums and millennia','Only millenniums','Only millennia'],answer:0};
S.reviewQuestions['4.51'] = {question:S.textbook.rolesQuestion,options:S.textbook.rolesOptions,answer:0};
