// Editorial direction guards, applied before lexical positive scoring.
// These are conservative high-certainty vetoes, not a universal semantic model.
const patterns = [
  ['military_advantage', /\b(?:forces?|military|army|troops?|soldiers?|fuerzas?|ej[eé]rcito|tropas?)\b.{0,80}\b(?:restor(?:ed|es?)|regain(?:ed|s)?|recover(?:ed|s)?|recupera(?:n|ron)?|restaur(?:a|aron))\b.{0,22}\b(?:control|positions?|territor(?:y|ies)|posiciones?|territorio|control territorial)\b/i],
  ['military_advantage', /\b(?:military|army|forces?|troops?|navy|air force|soldiers?|batallions?|brigades?|militares?|ej[eé]rcito|tropas?|soldados?|fuerzas armadas|armada)\b.{0,100}\b(?:win(?:s|ning)?|victor(?:y|ies)|capture[sd]?|seiz(?:e|ed|es)|retak(?:e|es|en)|strike[sd]?|deploy(?:s|ed)?|advanc(?:e|ed|es)|conquer(?:s|ed)?|victoria|ganan?|captur(?:a|an|aron)|recuperan? posiciones|toman? territorio|despliegan?|atacan?|avanzan?)\b/i],
  ['military_advantage', /\b(?:victory|victoria|success(?:ful)?|[eé]xito(?:so)?|breakthrough|avance)\b.{0,80}\b(?:battle|frontline|military|army|combat|war|offensive|batalla|frente de guerra|militar|combate|ofensiva)\b/i],
  ['military_advantage', /\b(?:retak(?:e|es|en)|captur(?:e|es|ed|ing)|seiz(?:e|es|ed)|defeat(?:s|ed)?|deploy(?:s|ed)?|toma(?:n|ron)?|captur(?:a|an|aron)|retoman|recuperan?)\b.{0,100}\b(?:military|troops?|soldiers?|forces?|russian|ukrainian|battle|frontline|territor(?:y|ies)|ej[eé]rcito|tropas?|militar(?:es)?|posiciones|batalla|frente de guerra)\b/i],
  ['military_advantage', /\b(?:military|combat|army|missile|weapon|war drone|dron(?:es)? de combate|misil(?:es)?|arma(?:s)?|ej[eé]rcito)\b.{0,90}\b(?:unveils?|launch(?:es|ed)?|test(?:s|ed)?|deploy(?:s|ed)?|successful|advanced|presenta|lanza|prueba|despliega|exitoso|avanzad[oa])\b/i],
  ['competitive_result', /\b(?:defeats?|beat(?:s|ing)?|won|wins?|victory|champion|campe[oó]n|vence|venci[oó]|derrota|gan(?:a|an|[oó])|victoria)\b.{0,70}\b(?:match|game|tournament|final|league|team|rivals?|championship|partido|torneo|liga|equipo|rivales?|copa|campeonato)\b/i],
  ['environmental_deterioration', /\b(?:climate change|global warming|warming|heatwave|drought|deforestation|cambio clim[aá]tico|calentamiento global|sequ[ií]a|deforestaci[oó]n|olas? de calor)\b.{0,120}\b(?:threat(?:s|ens?)?|worsen(?:s|ed|ing)?|accelerat(?:e|es|ed|ing)|damage[sd]?|destroy(?:s|ed)?|loss|collapse|declin(?:e|es|ed|ing)|risk|amenaza|empeora|acelera|destruye|p[eé]rdida|colapso|declive|riesgo|deshielo)\b/i],
  ['environmental_deterioration', /\b(?:reefs?|corals?|biodiversity|habitats?|glaciers?|species|forests?|arrecifes?|corales?|biodiversidad|h[aá]bitats?|glaciares?|especies|bosques?)\b.{0,95}\b(?:face|facing|lose|losing|lost|shrink|shrinking|decline|declining|threatened|under threat|pierde|pierden|p[eé]rdida|se reducen|disminuyen|amenazad[oa]s?|colapsan?)\b/i],
  ['environmental_deterioration', /\b(?:record|accelerating|rising|growing|increased|r[eé]cord|acelerad[oa]|aumenta|aumento|se agrava)\b.{0,75}\b(?:warming|temperatures?|emissions?|glacier melt|sea level|calentamiento|temperaturas?|emisiones?|deshielo|nivel del mar)\b/i],
  ['harmful_discovery', /\b(?:discover(?:s|ed)?|find(?:s)?|reveals?|identif(?:y|ies|ied)|descubren?|descubri[oó]|hallan?|hall[oó]|revelan?|identifican?)\b.{0,110}\b(?:alarming|record deaths?|growing threat|more damage|decline|collapse|mass mortality|alarmante|muertes?|mortalidad|amenaza|deterioro|declive|colapso|p[eé]rdida|destrucci[oó]n)\b/i],
];

export function editorialGuard({ title = '', deck = '' } = {}) {
  // Title is the dominant event. Deck can help identify its direction but may
  // mention unrelated negatives; match across title + short deck only.
  const main = `${title} ${String(deck).slice(0, 220)}`;
  for (const [reason, pattern] of patterns) {
    if (pattern.test(main)) return reason;
  }
  return null;
}
