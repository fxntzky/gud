// GUD deliberately uses conservative, deterministic editorial rules.
// A story is not accepted merely because it sounds optimistic or contains
// words such as "new", "discover", or "innovation". It must describe a
// concrete beneficial outcome.

const outcomePatterns: RegExp[] = [
  /\b(?:restor(?:e|ed|es|ation|ing)|recover(?:s|ed|y|ies|ing)?|rebound(?:s|ed|ing)?|thriv(?:e|es|ed|ing))\b/i,
  /\brescu(?:e|ed|es|ing)\b/i,
  /\breintroduc(?:e|ed|tion|ing)\b/i,
  /\b(?:habitat|forest|wetland|reef|ecosystem|species|wildlife)\b.{0,34}\b(?:protected|restored|recovered|expanded|rebounds?|thrives?|grows?)\b/i,
  /\b(?:population|numbers?)\b.{0,28}\b(?:grows?|growing|rebounds?|recovers?|increases?)\b/i,

  // A decline only counts when the thing declining is clearly harmful.
  /\b(?:deaths?|mortality|emissions?|pollution|infections?|disease|poverty|homelessness|deforestation|waste|risk|costs?)\b.{0,32}\b(?:declin(?:e|ed|es|ing)|fall(?:s|ing)?|drop(?:s|ped|ping)?|decreas(?:e|ed|es|ing))\b/i,
  /\b(?:declin(?:e|ed|es|ing)|fall(?:s|ing)?|drop(?:s|ped|ping)?|decreas(?:e|ed|es|ing))\b.{0,24}\b(?:deaths?|mortality|emissions?|pollution|infections?|disease|poverty|homelessness|deforestation|waste|risk|costs?)\b/i,
  /\b(?:erad(?:icate|icated|ication)|eliminat(?:e|ed|ion))\b.{0,28}\b(?:disease|virus|infection|pollution|hazard|parasite|invasive)\b/i,

  // Health outcomes must include an actual benefit, not merely a new study.
  /\b(?:treatment|therapy|vaccine|drug|procedure)\b.{0,40}\b(?:effective|successful|improves?|reduces?|prevents?|protects?|saves?|extends?)\b/i,
  /\b(?:effective|successful|improves?|reduces?|prevents?|protects?|saves?|extends?)\b.{0,40}\b(?:treatment|therapy|vaccine|drug|procedure|survival|recovery)\b/i,
  /\b(?:survival|recovery)\b.{0,24}\b(?:improves?|increases?|rises?|doubles?)\b/i,
  /\bapprov(?:e|ed|al)\b.{0,28}\b(?:treatment|therapy|vaccine|medicine|drug)\b/i,

  // Concrete environmental / infrastructure improvements.
  /\b(?:cut|cuts|cutting|reduce|reduced|reduces|reducing)\b.{0,20}\b(?:carbon|greenhouse gas|emissions?|pollution|waste|risk|deaths?|mortality|energy use|water use)\b/i,
  /\b(?:renewable|solar|wind|clean energy)\b.{0,28}\b(?:record|surpass(?:es|ed)?|overtak(?:es|en)|increase(?:s|d)?|grow(?:s|th)?)\b/i,
  /\b(?:record|surpass(?:es|ed)?|overtak(?:es|en)|increase(?:s|d)?|grow(?:s|th)?)\b.{0,28}\b(?:renewable|solar|wind|clean energy)\b/i,
  /\b(?:saves?|saved|saving)\b.{0,18}\b(?:lives?|energy|water|money|time)\b/i,

  // Access and community benefit.
  /\b(?:expand(?:s|ed|ing)?|increase(?:s|d|ing)?)\b.{0,20}\baccess\b/i,
  /\bfree\b.{0,16}\b(?:clinic|care|service|program|programme|school meals?|transport|internet|housing|library)\b/i,
  /\b(?:opens?|reopens?)\b.{0,24}\b(?:library|school|clinic|hospital|park|museum|community cent(?:er|re))\b/i,
  /\b(?:donat(?:e|ed|es|ion|ions|ing)|fundrais(?:e|ed|es|ing))\b.{0,28}\b(?:million|thousand|food|meals?|books?|equipment|care|relief|community|school|hospital)\b/i,

  // "Breakthrough" only qualifies when tied to a public-interest domain.
  /\bbreakthrough\b.{0,34}\b(?:health|medical|medicine|cancer|disease|energy|battery|climate|conservation|water|agriculture|accessibility)\b/i,
  /\b(?:health|medical|medicine|cancer|disease|energy|battery|climate|conservation|water|agriculture|accessibility)\b.{0,34}\bbreakthrough\b/i,
];

const positivePatterns: Array<[RegExp, number]> = [
  [/\brestor(?:e|ed|es|ation|ing)\b/i, 4],
  [/\brecover(?:s|ed|y|ies|ing)?\b/i, 3],
  [/\brescu(?:e|ed|es|ing)\b/i, 4],
  [/\breintroduc(?:e|ed|tion|ing)\b/i, 3],
  [/\brebounds?\b/i, 3],
  [/\bthriv(?:e|es|ed|ing)\b/i, 3],
  [/\beradicat(?:e|ed|ion|ing)\b/i, 5],
  [/\bexpands? access\b/i, 4],
  [/\breduc(?:e|ed|es|ing) (?:carbon |greenhouse gas )?(?:emissions?|pollution|waste|risk|deaths?|mortality)\b/i, 4],
  [/\bcut(?:s|ting)? (?:carbon |greenhouse gas )?(?:emissions?|pollution|waste|risk|deaths?|mortality)\b/i, 4],
  [/\bsaves? (?:lives?|energy|water|money|time)\b/i, 4],
  [/\beffective(?:ly|ness)?\b/i, 2],
  [/\bsuccess(?:ful|fully)?\b/i, 2],
  [/\bimprov(?:e|ed|es|ement|ements|ing)\b/i, 2],
  [/\bprotect(?:s|ed|ion|ing)?\b/i, 2],
  [/\bprevent(?:s|ed|ion|ing)?\b/i, 2],
  [/\baccessible\b/i, 1],
  [/\bconservation\b/i, 1],
  [/\brenewable\b/i, 1],
  [/\bclean energy\b/i, 2],
  [/\bcommunity\b/i, 1],
  [/\bvolunteer(?:s|ed|ing)?\b/i, 1],
  [/\bdonat(?:e|ed|es|ion|ions|ing)\b/i, 2],
];

const negativePatterns: Array<[RegExp, number]> = [
  [/\bwar\b/i, -12],
  [/\battack(?:s|ed)?\b/i, -10],
  [/\bkilled?\b/i, -12],
  [/\bmassacre\b/i, -14],
  [/\bshooting\b/i, -12],
  [/\bmurder(?:s|ed)?\b/i, -12],
  [/\bhostage(?:s)?\b/i, -10],
  [/\bairstrike(?:s)?\b/i, -12],
  [/\bbomb(?:ing|ed|s)?\b/i, -11],
  [/\bmissile(?:s)?\b/i, -10],
  [/\bscandal\b/i, -7],
  [/\bfraud\b/i, -7],
  [/\babuse\b/i, -6],
  [/\bviolence\b/i, -7],
  [/\bcrisis\b/i, -5],
  [/\bdisaster\b/i, -8],
  [/\bdeadly\b/i, -9],
  [/\bfatal(?:ly|ity|ities)?\b/i, -7],
  [/\bdeath toll\b/i, -10],
  [/\bcatastroph(?:e|ic)\b/i, -9],
  [/\bcollapse\b/i, -5],
  [/\boutbreak\b/i, -5],
];


// Headlines receive a stricter veto than excerpts. A tragic headline must not
// become "good news" merely because the excerpt later mentions a rescue,
// recovery effort or other positive word. GUD prefers false negatives here.
const severeNegativeHeadlinePatterns: RegExp[] = [
  /\b(?:die|dies|died|dead|killed|fatal|fatally)\b/i,
  /\bdeath toll\b/i,
  /\b(?:massacre|shooting|murder|hostage|airstrike|bombing|missile strike)\b/i,
  /\b(?:capsize|capsizes|capsized|shipwreck|plane crash|train crash|bus crash)\b/i,
  /\b(?:at least\s+)?\d+\s+(?:dead|killed|missing|injured)\b/i,
];

// Editorial exclusions are intentionally strict. GUD is designed as common-
// ground reading: no electoral/partisan politics and no sports results/fandom.
const politicalPatterns: RegExp[] = [
  /\b(?:election|electoral|voter|voters|voting|campaign|candidate|referendum)\b/i,
  /\b(?:politics|political|politician|partisan)\b/i,
  /\b(?:president|prime minister|parliament|congress|senate|senator|lawmaker|legislature|cabinet)\b/i,
  /\b(?:democrat|republican|labour party|conservative party)\b/i,
  /\b(?:government|governor|mayor)\b.{0,28}\b(?:policy|bill|law|ban|tax|election|vote|campaign|administration)\b/i,
  /\b(?:policy|legislation|court ruling|supreme court)\b/i,
];

const sportsPatterns: RegExp[] = [
  /\b(?:football|soccer|basketball|baseball|tennis|golf|rugby|cricket|hockey)\b/i,
  /\b(?:nba|nfl|mlb|nhl|fifa|uefa|olympic|olympics)\b/i,
  /\b(?:athlete|coach|tournament|championship|playoffs?|grand slam|world cup)\b/i,
  /\b(?:premier league|champions league|formula ?1|f1)\b/i,
];

// GUD is not a "silver lining after tragedy" feed.
const tragedyPatterns: RegExp[] = [
  /\bmassacre\b/i,
  /\bshooting\b/i,
  /\bmurder(?:s|ed)?\b/i,
  /\bhostage(?:s)?\b/i,
  /\bairstrike(?:s)?\b/i,
  /\bbomb(?:ing|ed|s)?\b/i,
  /\bmissile(?:s)?\b/i,
  /\bsexual assault\b/i,
  /\brape\b/i,
];

export const hasDisqualifyingSignal = (
  text: string,
  title = text,
): boolean =>
  severeNegativeHeadlinePatterns.some((pattern) => pattern.test(title)) ||
  [...tragedyPatterns, ...politicalPatterns, ...sportsPatterns].some((pattern) =>
    pattern.test(text),
  );

export const hasPositiveOutcomeSignal = (text: string): boolean =>
  outcomePatterns.some((pattern) => pattern.test(text));

export const scoreGoodNews = (text: string): number => {
  let score = 0;

  for (const [pattern, weight] of positivePatterns) {
    if (pattern.test(text)) score += weight;
  }

  for (const [pattern, weight] of negativePatterns) {
    if (pattern.test(text)) score += weight;
  }

  return score;
};
