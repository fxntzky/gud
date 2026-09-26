// GUD v6.3 editorial model
// ------------------------
// Editorial eligibility is evaluated as context, not as a bag of keywords.
// The hierarchy is title -> deck/subtitle -> excerpt. A positive secondary
// detail cannot rescue a story whose dominant event is clearly negative.

const strongOutcomePatterns = [
    // Recovery / restoration / conservation
    /\b(?:restor(?:e|ed|es|ation|ing)|rebuild(?:s|ing|t)?|reopen(?:s|ed|ing)?|reintroduc(?:e|ed|tion|ing)|thriv(?:e|es|ed|ing)|rebound(?:s|ed|ing)?)\b/i,
    /\b(?:restaur(?:a|an|ado|ada|ados|adas|aci[oó]n)|reconstru(?:ye|yen|ido|ida|cci[oó]n)|reabre|reabren|reintroduc(?:e|en|ido|ida|idos|idas|ci[oó]n)|prospera|prosperan|repunta|repuntan)\b/i,

    // Harm reduced or eliminated
    /\b(?:deaths?|mortality|emissions?|pollution|infections?|disease|poverty|homelessness|deforestation|waste|risk|costs?)\b.{0,36}\b(?:declin(?:e|ed|es|ing)|fall(?:s|ing)?|drop(?:s|ped|ping)?|decreas(?:e|ed|es|ing)|reduc(?:e|ed|es|ing)|cut(?:s|ting)?)\b/i,
    /\b(?:muertes?|mortalidad|emisiones?|contaminaci[oó]n|infecciones?|enfermedad|pobreza|deforestaci[oó]n|residuos?|riesgo|costos?)\b.{0,38}\b(?:baja|bajan|cae|caen|disminuye|disminuyen|reduce|reducen|redujo|recorta|recortan)\b/i,
    /\b(?:erad(?:icate|icated|ication)|eliminat(?:e|ed|ion))\b.{0,30}\b(?:disease|virus|infection|pollution|hazard|parasite|invasive)\b/i,
    /\b(?:erradic(?:a|ado|ada|aci[oó]n)|elimin(?:a|ado|ada|aci[oó]n))\b.{0,32}\b(?:enfermedad|virus|infecci[oó]n|contaminaci[oó]n|riesgo|par[aá]sito|invasora)\b/i,

    // Demonstrated health benefit
    /\b(?:treatment|therapy|vaccine|drug|procedure)\b.{0,44}\b(?:effective|successful|improves?|reduces?|prevents?|protects?|saves?|extends?)\b/i,
    /\b(?:tratamiento|terapia|vacuna|f[aá]rmaco|medicamento|procedimiento)\b.{0,46}\b(?:eficaz|efectivo|efectiva|exitoso|exitosa|mejora|reduce|previene|protege|salva|prolonga)\b/i,
    /\bapprov(?:e|ed|al)\b.{0,30}\b(?:treatment|therapy|vaccine|medicine|drug)\b/i,
    /\b(?:aprueban|aprobado|aprobada|autoriza|autorizan|autorizado|autorizada)\b.{0,32}\b(?:tratamiento|terapia|vacuna|medicamento|f[aá]rmaco)\b/i,

    // Access / public benefit
    /\b(?:expand(?:s|ed|ing)?|increase(?:s|d|ing)?)\b.{0,22}\baccess\b/i,
    /\b(?:ampl[ií]a|ampl[ií]an|aumenta|aumentan)\b.{0,24}\b(?:acceso|cobertura)\b/i,
    /\bfree\b.{0,18}\b(?:clinic|care|service|program|programme|school meals?|transport|internet|housing|library)\b/i,
    /\bgratis\b.{0,20}\b(?:cl[ií]nica|atenci[oó]n|servicio|programa|comedor|transporte|internet|vivienda|biblioteca)\b/i,
    /\b(?:opens?|reopens?)\b.{0,26}\b(?:library|school|clinic|hospital|park|museum|community cent(?:er|re))\b/i,
    /\b(?:abre|abren|reabre|reabren)\b.{0,30}\b(?:biblioteca|escuela|colegio|cl[ií]nica|hospital|parque|museo|centro comunitario)\b/i,

    // Clean energy / conservation milestones
    /\b(?:renewable|solar|wind|clean energy)\b.{0,32}\b(?:record|surpass(?:es|ed)?|overtak(?:es|en)|increase(?:s|d)?|grow(?:s|th)?)\b/i,
    /\b(?:renovable|solar|e[oó]lica|energ[ií]a limpia)\b.{0,32}\b(?:r[eé]cord|supera|aumenta|crece)\b/i,
];

const positivePatterns = [
    [/\brestor(?:e|ed|es|ation|ing)\b/i, 4],
    [/\brebuild(?:s|ing|t)?\b/i, 4],
    [/\breopen(?:s|ed|ing)?\b/i, 3],
    [/\brecover(?:s|ed|y|ies|ing)?\b/i, 3],
    [/\brescu(?:e|ed|es|ing)\b/i, 3],
    [/\breintroduc(?:e|ed|tion|ing)\b/i, 3],
    [/\brebounds?\b/i, 3],
    [/\bthriv(?:e|es|ed|ing)\b/i, 3],
    [/\beradicat(?:e|ed|ion|ing)\b/i, 5],
    [/\b(?:effective|successful|improves?|improvement|protects?|prevents?)\b/i, 2],
    [/\b(?:accessible|accessibility)\b/i, 1],
    [/\bconservation\b/i, 1],
    [/\bclean energy\b/i, 2],
    [/\b(?:donat(?:e|ed|es|ion|ions|ing)|fundrais(?:e|ed|es|ing))\b/i, 2],
    [/\b(?:milestone|record high|record low)\b/i, 1],
    [/\b(?:saves?|saved|saving)\b.{0,20}\b(?:lives?|energy|water|money|time)\b/i, 4],
    [/\b(?:expand(?:s|ed|ing)?|increase(?:s|d|ing)?)\b.{0,20}\baccess\b/i, 4],
    [/\b(?:reduce|reduced|reduces|reducing|cut|cuts|cutting)\b.{0,24}\b(?:emissions?|pollution|waste|risk|deaths?|mortality|infections?|poverty|deforestation|energy use|water use)\b/i, 4],
    [/\b(?:scholarship|scholarships|grant|grants)\b.{0,24}\b(?:awarded|funded|expanded|created|launched)\b/i, 3],
    [/\b(?:wins?|won|receives?|received|earns?|earned)\b.{0,24}\b(?:award|prize|recognition|honou?r)\b/i, 2],
    [/\bbreakthrough\b.{0,34}\b(?:health|medical|medicine|cancer|disease|energy|battery|climate|conservation|water|agriculture|accessibility)\b/i, 4],

    [/\b(?:biodiversity|wildlife|species|population|habitat)\b.{0,38}\b(?:increased|grew|recovered|rebounded|returned|strengthened|improved)\b/i, 3],
    [/\b(?:more diverse|greater biodiversity|biodiversity gains?)\b/i, 3],

    // Spanish
    [/\b(?:biodiversidad|fauna|especies|poblaci[oó]n|h[aá]bitat)\b.{0,40}\b(?:aument[oó]|creci[oó]|se recuper[oó]|repunt[oó]|regres[oó]|se fortaleci[oó]|mejor[oó])\b/i, 3],
    [/\b(?:m[aá]s diverso|m[aá]s diversa|mayor biodiversidad)\b/i, 3],
    [/\brestaur(?:a|an|ado|ada|ados|adas|aci[oó]n)\b/i, 4],
    [/\breconstru(?:ye|yen|ido|ida|cci[oó]n)\b/i, 4],
    [/\breabre|reabren\b/i, 3],
    [/\brecuper(?:a|an|ado|ada|ados|adas|aci[oó]n)\b/i, 3],
    [/\b(?:rescata|rescatan|rescat[oó]|rescatad[oa]s?|rescate)\b/i, 3],
    [/\breintroduc(?:e|en|ido|ida|idos|idas|ci[oó]n)\b/i, 3],
    [/\b(?:repunta|repuntan|prospera|prosperan)\b/i, 3],
    [/\b(?:erradica|erradicado|erradicada|erradicaci[oó]n)\b/i, 5],
    [/\b(?:eficaz|efectivo|efectiva|mejora|mejor[oó]|mejoran|protege|protegen|previene|previenen)\b/i, 2],
    [/\b(?:accesible|accesibilidad)\b/i, 1],
    [/\bconservaci[oó]n\b/i, 1],
    [/\benerg[ií]a limpia\b/i, 2],
    [/\b(?:donaci[oó]n|donaciones|donan|don[oó]|recaudan|recaudaci[oó]n)\b/i, 2],
    [/\b(?:hito|r[eé]cord)\b/i, 1],
    [/\b(?:salva|salvan|ahorra|ahorran)\b.{0,20}\b(?:vidas?|energ[ií]a|agua|dinero|tiempo)\b/i, 4],
    [/\b(?:ampl[ií]a|ampl[ií]an|aumenta|aumentan)\b.{0,22}\b(?:acceso|cobertura)\b/i, 4],
    [/\b(?:reduce|reducen|redujo|recorta|recortan)\b.{0,24}\b(?:emisiones?|contaminaci[oó]n|residuos?|riesgo|muertes?|mortalidad|infecciones?|pobreza|deforestaci[oó]n|consumo de energ[ií]a|consumo de agua)\b/i, 4],
    [/\b(?:beca|becas|subsidio|subsidios)\b.{0,24}\b(?:otorgad[oa]s?|financiad[oa]s?|ampliad[oa]s?|cread[oa]s?|lanzad[oa]s?)\b/i, 3],
    [/\b(?:gana|ganan|gan[oó]|recibe|reciben|recibi[oó]|obtiene|obtienen|obtuvo)\b.{0,24}\b(?:premio|reconocimiento|distinci[oó]n)\b/i, 2],
    [/\b(?:avance|hallazgo)\b.{0,34}\b(?:salud|medicina|c[aá]ncer|enfermedad|energ[ií]a|bater[ií]a|clima|conservaci[oó]n|agua|agricultura|accesibilidad)\b/i, 4],

    // v6.7 Spanish semantic outcomes. These mirror eligibility signals so a
    // qualifying story is not immediately lost again at MIN_SCORE.
    [/\b(?:desarrollan?|desarroll[oó]|desarrollaron|crean?|cre[oó]|crearon|dise[ñn]an?|dise[ñn][oó]|dise[ñn]aron)\b.{0,72}\b(?:herramienta|m[eé]todo|sistema|tecnolog[ií]a|dispositivo|programa|modelo|t[eé]cnica|soluci[oó]n|juego|plataforma)\b.{0,90}\b(?:para|que)\b.{0,70}\b(?:detectar|diagnosticar|prevenir|proteger|reducir|mejorar|recuperar|conservar|salvar|limpiar|tratar|monitorear|monitorizar|facilitar|acercar|fomentar|ense[ñn]ar|ayudar|alertar|remover|eliminar)\b/i, 3],
    [/\b(?:demuestran?|demostr[oó]|demostraron|constatan?|constat[oó]|constataron)\b.{0,44}\b(?:que\s+)?(?:es posible|se puede|puede|pueden)\b.{0,76}\b(?:fomentar|mejorar|reducir|prevenir|proteger|conservar|restaurar|recuperar|aumentar|facilitar|ense[ñn]ar|aprender|ahorrar)\b/i, 3],
    [/\b(?:sirve|sirven|funciona|funcionan)\b.{0,30}\bcomo\b.{0,36}\b(?:refugio|h[aá]bitat|corredor|zona de caza|reservorio)\b/i, 3],
    [/\b(?:interpretan|monitorean|monitorizan|vigilan|mapean|cartograf[ií]an)\b.{0,72}\b(?:para|con el fin de)\b.{0,48}\b(?:salvar|proteger|conservar|prevenir|anticipar|reducir|cuidar)\b/i, 3],
    [/\b(?:crean?|cre[oó]|crearon|desarrollan?|desarroll[oó]|desarrollaron)\b.{0,58}\b(?:juego|programa|iniciativa|proyecto|herramienta|espacio)\b.{0,100}\b(?:conversar|dialogar|reconectar|conectar|participar|aprender|colaborar|convivir|acercar)\b/i, 3],
    [/\b(?:combinan|presentan|muestran)\b.{0,64}\b(?:mayor|m[aá]s)\b.{0,44}\b(?:tolerancia|resistencia|crecimiento|eficiencia|diversidad)\b/i, 2],
    [/\b(?:demuestran?|demostr[oó]|demostraron|ha demostrado)\b.{0,110}\b(?:mayor riqueza|mayor biodiversidad|m[aá]s biodiversidad|albergan|sirven como refugio)\b/i, 3],
    [/\b(?:acercan|acerca|lleva|llevan)\b.{0,42}\b(?:ciencia|conocimiento|cultura|educaci[oó]n|arte)\b.{0,48}\b(?:ciudadan[ií]a|comunidad|barrios?|escuelas?|p[uú]blico)\b/i, 2],
    [/\b(?:nuevas? pistas?|nuevos? datos|nueva evidencia|nuevo conocimiento)\b.{0,80}\b(?:sobre|acerca de|para entender|para comprender)\b/i, 2],
    [/\b(?:descubren|descubri[oó]|descubrieron|hallan|hall[oó]|hallaron|identifican|identific[oó]|identificaron|documentan|document[oó]|documentaron|secuencian|secuenci[oó]|secuenciaron)\b/i, 2],
    [/\bpor primera vez\b.{0,100}\b(?:documentan?|document[oó]|demuestran?|demostr[oó]|observan?|observ[oó]|registran?|registr[oó]|identifican?|identific[oó])\b/i, 2],
    [/\b(?:revelan?|revel[oó]|revelaron)\b.{0,72}\b(?:resistencia|mecanismo|estructura|origen|propiedad|comportamiento|patr[oó]n|capacidad)\b/i, 2],
    [/\b(?:han|ha)\s+secuenciado\b.{0,90}\b(?:genoma|genomas|especies?)\b/i, 2],
];

const negativePatterns = [
    [/\b(?:war|guerra)\b/i, -12],
    [/\b(?:attack|attacks|attacked|ataque|ataques)\b/i, -10],
    [/\b(?:killed|murder|murdered|asesinado|asesinada|asesinato)\b/i, -12],
    [/\b(?:massacre|masacre|shooting|tiroteo|hostage|hostages|reh[eé]n|rehenes)\b/i, -12],
    [/\b(?:airstrike|airstrikes|bombing|bombed|bombardeo|bombardeos)\b/i, -12],
    [/\b(?:scandal|esc[aá]ndalo|fraud|fraude|abuse|abuso|violence|violencia)\b/i, -7],
    [/\b(?:crisis|disaster|desastre|catastrophe|catastrophic|cat[aá]strofe)\b/i, -7],
    [/\b(?:collapse|collapsed|colapso|colapsa|outbreak|brote)\b/i, -5],
    [/\b(?:failed|fails|failing|failure|unsuccessful|fracasa|fracas[oó]|fracaso|falla|fall[oó]|fallida|fallido)\b/i, -8],
    [/\b(?:loot(?:s|ed|ing)?|looting|saquea|saquean|saquearon|saqueo|robbery|theft|robo|roban|robaron)\b/i, -9],
    [/\b(?:injured|injury|trapped|herid[oa]s?|atrapad[oa]s?)\b/i, -4],
    [/\b(?:under suspicion|suspected|accused|accusation|allegation|controversy|backlash)\b/i, -6],
    [/\b(?:bajo sospecha|sospecha|acusad[oa]|acusaci[oó]n|pol[eé]mica|controversia)\b/i, -6],
    [/\b(?:losing|worsening|deteriorating|shrinking)\b/i, -4],
    [/\b(?:pierde|pierden|empeora|empeoran|deteriora|deterioran|se reduce|se reducen)\b/i, -4],
    // Hypothetical benefit is weaker than an observed result.
    [/\b(?:could|may|might|potentially)\b.{0,24}\b(?:improve|reduce|prevent|protect|save|help)\b/i, -4],
    [/\b(?:podr[ií]a|podr[ií]an|puede|pueden|potencialmente)\b.{0,26}\b(?:mejorar|reducir|prevenir|proteger|salvar|ayudar)\b/i, -4],
];

const positiveResolutionHeadlinePatterns = [
    /\b(?:rescued?|saved?|survives?|survived|restored|rebuilds?|rebuilt|reopens?|protected|cleared|exonerated)\b/i,
    /\b(?:rescata|rescatan|rescat[oó]|rescatad[oa]s?|salva|salvan|sobrevive|sobrevivi[oó]|restaurad[oa]|reconstru(?:ye|yen|ido|ida)|reabre|reabren|proteg(?:e|en|ido|ida)|exonerad[oa]|absuelt[oa])\b/i,
    /\b(?:deaths?|mortality|emissions?|pollution|infections?|poverty|deforestation|waste|risk)\b.{0,28}\b(?:fall|falls|fell|decline|declines|declined|drop|drops|dropped|decrease|decreases|decreased|cut|cuts)\b/i,
    /\b(?:muertes?|mortalidad|emisiones?|contaminaci[oó]n|infecciones?|pobreza|deforestaci[oó]n|residuos?|riesgo)\b.{0,30}\b(?:baja|bajan|baj[oó]|cae|caen|cay[oó]|disminuye|disminuyen|disminuy[oó]|reduce|reducen|redujo)\b/i,
];

const hardNegativeHeadlinePatterns = [
    /\b(?:failed|fails|failing|failure|unsuccessful|could not|couldn't|unable to)\b/i,
    /\b(?:fracasa|fracas[oó]|fracaso|falla|fall[oó]|fallida|fallido|no logr[oó]|no logra|no pudo|no puede|incapaz de)\b/i,
    /\b(?:loot(?:s|ed|ing)?|looting|saquea|saquean|saquearon|saqueo|robbery|theft|steal(?:s|ing)?|stolen|robo|robos|roba|roban|robando|robaron|robado|robada|hurto|hurtos|ladr[oó]n|ladrones)\b/i,
    /\b(?:sin prestar ayuda|sin ayudar|without helping|refused to help)\b/i,
    /\b(?:destroy(?:ed|s)?|cancelled|canceled|worsen(?:s|ed|ing)?|deteriorat(?:e|ed|es|ing))\b/i,
    /\b(?:destruid[oa]|cancelad[oa]|empeora|deteriora)\b/i,
];

// These describe a negative *direction*, not merely a negative noun. They are
// evaluated before positive keyword scoring so “recover” in “less time to
// recover” cannot be mistaken for recovery.
const dominantNegativeHeadlinePatterns = [
    /\b(?:less|shorter|shrinking)\b.{0,24}\b(?:time|window|chance|capacity)\b.{0,18}\b(?:to recover|for recovery|of recovery)\b/i,
    /\b(?:menos|menor|se reduce|se acorta)\b.{0,26}\b(?:tiempo|margen|capacidad|posibilidad)\b.{0,20}\b(?:para recuperarse|de recuperaci[oó]n)\b/i,
    /\b(?:under suspicion|suspected|accused|accusation|allegation|controversy|backlash)\b/i,
    /\b(?:bajo sospecha|sospecha de|acusad[oa]|acusaci[oó]n|pol[eé]mica|controversia)\b/i,
    /\b(?:slop|misinformation|disinformation|deepfakes?|scams?|fraud)\b.{0,42}\b(?:dominat(?:e|es|ing)|spread(?:s|ing)?|surge(?:s|d)?|rise|rises|rising|grow(?:s|ing)?)\b/i,
    /\b(?:desinformaci[oó]n|estafas?|fraude|contenido basura)\b.{0,44}\b(?:domina|dominan|se extiende|aumenta|crece|prolifera)\b/i,
    /\b(?:coral reefs?|reefs?|species|wildlife|biodiversity|habitats?|populations?|forest cover|sea ice)\b.{0,42}\b(?:los(?:e|es|ing)|declin(?:e|es|ed|ing)|shrink(?:s|ing)?|fall(?:s|ing)?|drop(?:s|ping)?)\b/i,
    /\b(?:arrecifes?|especies|fauna|biodiversidad|h[aá]bitats?|poblaciones?|cobertura forestal|hielo marino)\b.{0,44}\b(?:pierde|pierden|cae|caen|disminuye|disminuyen|se reduce|se reducen)\b/i,
];

const dominantNegativeContextPatterns = [
    /\b(?:losing|worsening|deteriorating|shrinking|under suspicion|suspected use|accused of|lamenting)\b/i,
    /\b(?:pierde|pierden|empeora|empeoran|deteriora|deterioran|bajo sospecha|uso sospechoso|acusad[oa] de|lamentan)\b/i,
    /\b(?:less|shorter|shrinking)\b.{0,30}\b(?:time|chance|capacity)\b.{0,24}\b(?:recover|recovery)\b/i,
    /\b(?:menos|menor|se reduce|se acorta)\b.{0,32}\b(?:tiempo|margen|capacidad|posibilidad)\b.{0,22}\b(?:recuperarse|recuperaci[oó]n)\b/i,
];

const advocacyOnlyHeadlinePatterns = [
    // Calls, denunciations and protests describe unresolved conflict or demands,
    // not a realized beneficial outcome. They may pass only when title/deck also
    // contains a concrete positive resolution (e.g. land returned, law changed,
    // protection granted, service restored).
    /\b(?:rejects?|denounces?|demands?|urges?|calls? for|protests?|opposes?|appeals? for)\b/i,
    /\b(?:rechaza|rechazan|denuncia|denuncian|denunciaron|exige|exigen|exigieron|pide|piden|reclama|reclaman|protesta|protestan|se opone|se oponen)\b/i,
];

const contextualNegativeHeadlinePatterns = [
    /\b(?:crash(?:es|ed)?|collision|overturn(?:s|ed)?|capsize|capsized|trapped|injured)\b/i,
    /\b(?:accidente|choque|choc[oó]|vuelca|volc[oó]|volcado|volcada|atrapad[oa]s?|herid[oa]s?)\b/i,
];

const severeNegativeHeadlinePatterns = [
    /\b(?:die|dies|died|dead|killed|fatal|fatally|muere|murieron|muerto|muerta|mortal)\b/i,
    /\b(?:massacre|masacre|shooting|tiroteo|murder|asesinato|hostage|reh[eé]n|airstrike|bombing|bombardeo|missile strike)\b/i,
    /\b(?:at least\s+)?\d+\s+(?:dead|killed|missing|injured)\b/i,
    /\b\d+\s+(?:muertos?|fallecidos?|desaparecidos?|heridos?)\b/i,
];

const mortalityHeadlinePatterns = [
    // The central event is an increase or discovery of deaths, not a reduction.
    /\b(?:found|finds?|discovered|reports?|reported)\b.{0,34}\b(?:dead|deaths?|mortality)\b/i,
    /\b(?:unusual|abnormal|record|rising|increasing|surge(?:s|d)?|spike(?:s|d)?)\b.{0,34}\b(?:deaths?|mortality|dead)\b/i,
    /\b(?:deaths?|mortality)\b.{0,34}\b(?:rise|rises|rising|increase|increases|increased|surge|surges|spike|spikes)\b/i,
    /\b(?:hallan|hallaron|encuentran|encontraron|reportan|reportaron)\b.{0,36}\b(?:muert[oa]s?|muertes?|mortalidad)\b/i,
    /\b(?:inusual|anormal|r[eé]cord|creciente|aumento|incremento)\b.{0,36}\b(?:muertes?|mortalidad|muert[oa]s?)\b/i,
    /\b(?:muertes?|mortalidad)\b.{0,34}\b(?:aumenta|aumentan|aument[oó]|crece|crecen|sube|suben|incrementa|incrementan)\b/i,
];

const endangeredProblemPatterns = [
    /\b(?:critically endangered|endangered species|at risk of extinction|threatened with extinction)\b/i,
    /\b(?:en peligro cr[ií]tico|especie en peligro|especies en peligro|riesgo de extinci[oó]n|amenazad[oa]s? de extinci[oó]n)\b/i,
];

const militaryWeaponsPatterns = [
    // A technical or military success is not automatically a socially desirable outcome.
    /\b(?:torpedoes?|missiles?|weapons?|weaponized|warfare|combat systems?|combat drones?|military drones?|autonomous combat|autonomous warfare)\b/i,
    /\b(?:navy|air force|army|military)\b.{0,42}\b(?:launch(?:es|ed)?|test(?:s|ed)?|weapon|torpedo|missile|combat|drone)\b/i,
    /\b(?:torpedos?|misiles?|armas?|armamento|guerra|sistemas? de combate|drones? militares?|combate aut[oó]nomo|guerra aut[oó]noma)\b/i,
    /\b(?:armada|fuerza a[eé]rea|ej[eé]rcito|militar)\b.{0,44}\b(?:lanza|lanz[oó]|prueba|prob[oó]|arma|torpedo|misil|combate|dron)\b/i,
];

const mixedOutcomePatterns = [
    // A positive first clause followed by an important safety/efficacy reversal is mixed, not GUD.
    /\bapprov(?:e|ed|al)\b.{0,72}\bbut\b.{0,72}\b(?:not recommend(?:ed|ing)?|isn['’]?t recommend(?:ed|ing)?|warn(?:s|ed|ing)?|concern(?:s|ed)?|risk)\b/i,
    /\b(?:aprobad[oa]|aprueba|aprobaron|autorizad[oa]|autoriza)\b.{0,72}\b(?:pero|aunque)\b.{0,72}\b(?:no recomienda|no recomiendan|desaconseja|advierten?|preocupa|riesgo)\b/i,
];



// GUD v6.3 eligibility layer
// --------------------------
// Scoring ranks eligible stories. It no longer decides eligibility by itself.
// A story must describe a realized, desirable outcome in its main editorial
// context (title + deck), not merely contain optimistic vocabulary somewhere.
const geopoliticalPatterns = [
    /\b(?:strait of hormuz|ceasefire|peace talks?|sanctions?|diplomatic|diplomacy|foreign minister|security council|nato|territorial dispute|nuclear talks?|border crossing)\b/i,
    /\b(?:estrecho de ormuz|alto el fuego|negociaciones de paz|sanciones?|diplom[aá]tic[oa]|diplomacia|canciller|consejo de seguridad|otan|disputa territorial|negociaciones nucleares|paso fronterizo)\b/i,
];

const conditionalFuturePatterns = [
    /\b(?:to|will|would|could|may|might|plans? to|aims? to|seeks? to|set to)\b.{0,56}\b(?:open|reopen|launch|expand|restore|reduce|improve|protect|save|cut|build|create|deliver|provide)\b.{0,80}\bif\b/i,
    /\bif\b.{0,80}\b(?:agrees?|approves?|passes?|accepts?|funds?|allows?)\b/i,
    /\b(?:planea|planean|busca|buscan|pretende|pretenden|podr[ií]a|podr[ií]an|va a|van a)\b.{0,58}\b(?:abrir|reabrir|lanzar|ampliar|restaurar|reducir|mejorar|proteger|salvar|construir|crear)\b.{0,80}\bsi\b/i,
    /\bsi\b.{0,80}\b(?:acepta|aceptan|aprueba|aprueban|permite|permiten|financia|financian)\b/i,
];

const analysisExplainerPatterns = [
    /\b(?:challenges? and opportunities|pros and cons|what to know|what you need to know|here['’]s why|explainer|analysis:|opinion:|commentary:|debate over|the case for|the case against)\b/i,
    /\b(?:desaf[ií]os? y oportunidades|pros y contras|qu[eé] hay que saber|lo que hay que saber|por qu[eé]|explicador|an[aá]lisis:|opini[oó]n:|debate sobre|argumentos a favor|argumentos en contra)\b/i,
];

const productLaunchPatterns = [
    /\b(?:meet the|unveils?|reveals?|debuts?|introduces?|launches?)\b.{0,64}\b(?:car|vehicle|suv|phone|device|product|collection|chair|watch|shoe|sneaker|camera|laptop|speaker|headphones?)\b/i,
    /\b(?:first|new)\b.{0,28}\b(?:electric car|electric vehicle|ev|suv|smartphone|watch|camera|laptop|product|collection)\b/i,
    /\b(?:presenta|revela|estrena|lanza|introduce)\b.{0,64}\b(?:auto|coche|veh[ií]culo|suv|tel[eé]fono|dispositivo|producto|colecci[oó]n|silla|reloj|zapatillas?|c[aá]mara|port[aá]til)\b/i,
];

const publicBenefitOutcomePatterns = [
    /\b(?:cuts?|reduces?|lower(?:s|ed)?|prevents?|protects?|improves?|expands?)\b.{0,34}\b(?:emissions?|pollution|energy use|water use|injuries|deaths?|risk|costs?|access|safety|health|recovery|outcomes?)\b/i,
    /\b(?:reduce|reducen|redujo|baja|bajan|previene|previenen|protege|protegen|mejora|mejoran|ampl[ií]a|ampl[ií]an)\b.{0,36}\b(?:emisiones?|contaminaci[oó]n|consumo de energ[ií]a|consumo de agua|lesiones|muertes?|riesgo|costos?|acceso|seguridad|salud|recuperaci[oó]n|resultados?)\b/i,
];

const genericRealizedOutcomePatterns = [
    // Restoration, reopening, preservation and recovery already achieved.
    /\b(?:restored|rebuilt|reopened|reintroduced|recovered|rescued|saved|protected|preserved|returned to|granted to|reconnected|revived|revitalized)\b/i,
    /\b(?:restaurad[oa]s?|reconstruid[oa]s?|reabri[oó]|reabierto|reabierta|reintroducid[oa]s?|recuperad[oa]s?|rescatad[oa]s?|salvad[oa]s?|protegid[oa]s?|preservad[oa]s?|devuelt[oa]s? a|otorgad[oa]s? a|reconectad[oa]s?|revitalizad[oa]s?)\b/i,

    // Measurable harm reduction or beneficial trend.
    /\b(?:deaths?|mortality|emissions?|pollution|infections?|poverty|homelessness|deforestation|waste|risk|costs?|energy use|water use)\b.{0,44}\b(?:fell|falls|declined|declines|dropped|drops|decreased|decreases|reduced|cut)\b/i,
    /\b(?:muertes?|mortalidad|emisiones?|contaminaci[oó]n|infecciones?|pobreza|sinhogarismo|deforestaci[oó]n|residuos?|riesgo|costos?|consumo de energ[ií]a|consumo de agua)\b.{0,46}\b(?:baj[oó]|baja|bajan|cay[oó]|cae|caen|disminuy[oó]|disminuye|disminuyen|se redujo|se reduce|se reducen|recort[oó])\b/i,

    // Access or service actually expanded/opened.
    /\b(?:opened|reopened|expanded|extended|provided|delivered|funded|awarded)\b.{0,42}\b(?:access|clinic|hospital|school|library|museum|park|housing|transport|internet|care|scholarships?|grants?|services?)\b/i,
    /\b(?:abri[oó]|reabri[oó]|ampli[oó]|extendi[oó]|brind[oó]|entreg[oó]|financi[oó]|otorg[oó])\b.{0,44}\b(?:acceso|cl[ií]nica|hospital|escuela|biblioteca|museo|parque|vivienda|transporte|internet|atenci[oó]n|becas?|subsidios?|servicios?)\b/i,

    // Demonstrated improvement / successful intervention.
    /\b(?:improved|improves|improving|boosted|increased|strengthened)\b.{0,42}\b(?:health|recovery|outcomes?|survival|access|safety|biodiversity|habitat|literacy|learning|air quality|water quality)\b/i,
    /\b(?:mejor[oó]|mejora|mejoran|aument[oó]|aumenta|aumentan|fortaleci[oó]|fortalece)\b.{0,44}\b(?:salud|recuperaci[oó]n|resultados?|supervivencia|acceso|seguridad|biodiversidad|h[aá]bitat|alfabetizaci[oó]n|aprendizaje|calidad del aire|calidad del agua)\b/i,
];



// v6.7 — Spanish semantic recall
// --------------------------------
// Spanish science, education and community reporting often expresses a
// concrete positive outcome through verbs such as “desarrollan”, “demuestran”
// or “crearon” instead of explicit sentiment words. These patterns recognise
// those constructions without weakening any existing hard-negative veto.
const spanishRealizedActionPatterns = [
    // A concrete tool/method/program has already been created for a beneficial purpose.
    /\b(?:desarrollan?|desarroll[oó]|desarrollaron|crean?|cre[oó]|crearon|dise[ñn]an?|dise[ñn][oó]|dise[ñn]aron|implementan?|implement[oó]|implementaron)\b.{0,72}\b(?:herramienta|m[eé]todo|sistema|tecnolog[ií]a|dispositivo|programa|modelo|t[eé]cnica|soluci[oó]n|juego|plataforma)\b.{0,90}\b(?:para|que)\b.{0,70}\b(?:detectar|diagnosticar|prevenir|proteger|reducir|mejorar|recuperar|conservar|salvar|limpiar|tratar|monitorear|monitorizar|facilitar|acercar|fomentar|ense[ñn]ar|ayudar|alertar|remover|eliminar)\b/i,

    // Demonstrated feasibility with a constructive result.
    /\b(?:demuestran?|demostr[oó]|demostraron|constatan?|constat[oó]|constataron|comprueban?|comprob[oó]|comprobaron)\b.{0,44}\b(?:que\s+)?(?:es posible|se puede|puede|pueden)\b.{0,76}\b(?:fomentar|mejorar|reducir|prevenir|proteger|conservar|restaurar|recuperar|aumentar|facilitar|ense[ñn]ar|aprender|ahorrar)\b/i,

    // Concrete community/education creations whose purpose is reconnection or learning.
    /\b(?:crean?|cre[oó]|crearon|desarrollan?|desarroll[oó]|desarrollaron)\b.{0,58}\b(?:juego|programa|iniciativa|proyecto|herramienta|espacio)\b.{0,100}\b(?:conversar|dialogar|reconectar|conectar|participar|aprender|colaborar|convivir|acercar)\b/i,

    // Observed ecological co-benefit.
    /\b(?:sirve|sirven|funciona|funcionan)\b.{0,30}\bcomo\b.{0,36}\b(?:refugio|h[aá]bitat|corredor|zona de caza|reservorio)\b/i,

    // A community is already using knowledge/monitoring to protect something concrete.
    /\b(?:interpretan|monitorean|monitorizan|vigilan|mapean|cartograf[ií]an)\b.{0,72}\b(?:para|con el fin de)\b.{0,48}\b(?:salvar|proteger|conservar|prevenir|anticipar|reducir|cuidar)\b/i,

    // Observed beneficial traits or ecological functions.
    /\b(?:combinan|presentan|muestran)\b.{0,64}\b(?:mayor|m[aá]s)\b.{0,44}\b(?:tolerancia|resistencia|crecimiento|eficiencia|diversidad)\b/i,
    /\b(?:demuestran?|demostr[oó]|demostraron|ha demostrado)\b.{0,110}\b(?:mayor riqueza|mayor biodiversidad|m[aá]s biodiversidad|albergan|sirven como refugio)\b/i,

    // Public access to science/culture/education is itself a realized community benefit.
    /\b(?:acercan|acerca|lleva|llevan)\b.{0,42}\b(?:ciencia|conocimiento|cultura|educaci[oó]n|arte)\b.{0,48}\b(?:ciudadan[ií]a|comunidad|barrios?|escuelas?|p[uú]blico)\b/i,
];

// Knowledge gain can itself be a valid Science outcome, provided the thing
// discovered is not primarily a worsening, danger or tragedy. This keeps GUD
// open to genuine discovery without turning Science into generic “interesting news”.
const spanishScienceKnowledgeGainPatterns = [
    /\b(?:nuevas? pistas?|nuevos? datos|nueva evidencia|nuevo conocimiento)\b.{0,80}\b(?:sobre|acerca de|para entender|para comprender)\b/i,
    /\b(?:descubren|descubri[oó]|descubrieron|hallan|hall[oó]|hallaron|identifican|identific[oó]|identificaron|documentan|document[oó]|documentaron|secuencian|secuenci[oó]|secuenciaron|describen|describi[oó]|describieron)\b/i,
    /\bpor primera vez\b.{0,100}\b(?:documentan?|document[oó]|demuestran?|demostr[oó]|observan?|observ[oó]|registran?|registr[oó]|identifican?|identific[oó])\b/i,
    /\b(?:revelan?|revel[oó]|revelaron)\b.{0,72}\b(?:resistencia|mecanismo|estructura|origen|propiedad|comportamiento|patr[oó]n|capacidad)\b/i,
    /\b(?:han|ha)\s+secuenciado\b.{0,90}\b(?:genoma|genomas|especies?)\b/i,
];

const spanishResearchCuePatterns = [
    /\b(?:estudio|investigaci[oó]n|investigadores?|cient[ií]fic[oa]s?|equipo cient[ií]fico|universidad|an[aá]lisis|genoma|secuenciado|secuenciaron)\b/i,
];

const spanishScienceKnowledgeVetoPatterns = [
    /\b(?:muertes?|mortalidad|asesinad[oa]s?|violencia|guerra|ataques?|bombardeos?|desnutrici[oó]n)\b/i,
    /\b(?:crisis|deterioro|declive|colapso|extinci[oó]n|p[eé]rdida|destrucci[oó]n|fracaso)\b/i,
    /\b(?:amenaza|amenazas|amenazan|peligro|da[ñn]o|da[ñn]os|riesgo)\b.{0,36}\b(?:aumenta|aumentan|crece|crecen|mayor|grave|severo|alto)\b/i,
    /\b(?:empeora|empeoran|se deteriora|se deterioran|cae|caen|disminuye|disminuyen|se reduce|se reducen)\b/i,
];

const realizedOutcomeByCategory = {
    health: [
        /\b(?:improve|improves|improved|improving)\b.{0,26}\b(?:stroke|patient|health|recovery|outcomes?|survival|mobility|quality of life)\b/i,
        /\b(?:treatment|therapy|vaccine|drug|procedure|program)\b.{0,48}\b(?:effective|reduced|reduces|improved|improves|prevented|prevents|protected|protects|saved|saves)\b/i,
        /\b(?:mejora|mejor[oó]|mejoran)\b.{0,28}\b(?:salud|recuperaci[oó]n|resultados?|supervivencia|movilidad|calidad de vida)\b/i,
        /\b(?:tratamiento|terapia|vacuna|f[aá]rmaco|procedimiento|programa)\b.{0,50}\b(?:eficaz|redujo|reduce|mejor[oó]|mejora|previno|previene|protegi[oó]|protege|salv[oó]|salva)\b/i,
    ],
    nature: [
        /\b(?:biodiversity|wildlife|species|population|habitat|wetland|forest|reef|ecosystem)\b.{0,46}\b(?:recovered|rebounded|returned|increased|grew|thrived|restored|expanded|strengthened)\b/i,
        /\b(?:more diverse|greater biodiversity|biodiversity increased|biodiversity gains?|species returned|wildlife returned)\b/i,
        /\b(?:biodiversidad|fauna|especies|poblaci[oó]n|h[aá]bitat|humedal|bosque|arrecife|ecosistema)\b.{0,48}\b(?:se recuper[oó]|repunt[oó]|regres[oó]|aument[oó]|creci[oó]|prosper[oó]|fue restaurad[oa]|se ampli[oó]|se fortaleci[oó])\b/i,
        /\b(?:m[aá]s diverso|m[aá]s diversa|mayor biodiversidad|aument[oó] la biodiversidad|regresaron las especies|regres[oó] la fauna)\b/i,
    ],
    education: [
        /\b(?:scholarships?|grants?|school meals?|literacy|enrollment|graduation|learning outcomes?)\b.{0,44}\b(?:expanded|increased|improved|funded|awarded|provided|rose)\b/i,
        /\b(?:becas?|subsidios?|comedor escolar|alfabetizaci[oó]n|matr[ií]cula|graduaci[oó]n|resultados de aprendizaje)\b.{0,46}\b(?:se ampli[oó]|aument[oó]|mejor[oó]|financi[oó]|otorg[oó]|brind[oó]|subi[oó])\b/i,
    ],
    technology: [
        ...publicBenefitOutcomePatterns,
        /\b(?:technology|device|tool|system|software|robot)\b.{0,48}\b(?:improved accessibility|reduced waste|reduced energy use|improved safety|expanded access|cut emissions)\b/i,
        /\b(?:tecnolog[ií]a|dispositivo|herramienta|sistema|software|robot)\b.{0,50}\b(?:mejor[oó] la accesibilidad|redujo residuos|redujo el consumo de energ[ií]a|mejor[oó] la seguridad|ampli[oó] el acceso|redujo emisiones)\b/i,
    ],
    culture: [
        /\b(?:museum|library|theatre|theater|cinema|archive|heritage|historic|artwork|cultural site)\b.{0,52}\b(?:restored|reopened|recovered|preserved|digitized|returned|made accessible|opened to the public)\b/i,
        /\b(?:museo|biblioteca|teatro|cine|archivo|patrimonio|hist[oó]ric[oa]|obra|sitio cultural)\b.{0,54}\b(?:restaurad[oa]|reabri[oó]|recuperad[oa]|preservad[oa]|digitalizad[oa]|devuelt[oa]|hecho accesible|abri[oó] al p[uú]blico)\b/i,
    ],
    community: [
        /\b(?:community|residents?|neighbors?|volunteers?|families)\b.{0,52}\b(?:restored|rebuilt|opened|reopened|raised|funded|rescued|saved|provided|created)\b/i,
        /\b(?:comunidad|residentes|vecinos?|voluntarios?|familias)\b.{0,54}\b(?:restaur[oó]|reconstruy[oó]|abri[oó]|reabri[oó]|recaud[oó]|financi[oó]|rescat[oó]|salv[oó]|brind[oó]|cre[oó])\b/i,
    ],
    society: [
        /\b(?:housing|homelessness|poverty|public transport|accessibility|disability|inclusion|inequality|public safety|infrastructure|human rights)\b.{0,52}\b(?:improved|expanded|fell|declined|opened|restored|protected|granted|funded|provided)\b/i,
        /\b(?:vivienda|sinhogarismo|pobreza|transporte p[uú]blico|accesibilidad|discapacidad|inclusi[oó]n|desigualdad|seguridad p[uú]blica|infraestructura|derechos humanos)\b.{0,54}\b(?:mejor[oó]|se ampli[oó]|baj[oó]|disminuy[oó]|abri[oó]|restaur[oó]|protegi[oó]|otorg[oó]|financi[oó]|brind[oó])\b/i,
    ],
    science: [
        /\b(?:study|research|researchers?|scientists?)\b.{0,72}\b(?:found|finds|showed|shows|demonstrated|demonstrates)\b.{0,64}\b(?:reduces?|improves?|prevents?|protects?|restores?|increases? survival|cuts? emissions?|cleans? water|removes? pollution)\b/i,
        /\b(?:estudio|investigaci[oó]n|investigadores?|cient[ií]ficos?)\b.{0,74}\b(?:hall[oó]|halla|mostr[oó]|muestra|demostr[oó]|demuestra)\b.{0,66}\b(?:reduce|mejora|previene|protege|restaura|aumenta la supervivencia|reduce emisiones|limpia el agua|elimina contaminaci[oó]n)\b/i,
        /\bbreakthrough\b.{0,46}\b(?:treatment|health|medicine|clean energy|battery|water|conservation|accessibility|agriculture)\b/i,
        /\bavance\b.{0,48}\b(?:tratamiento|salud|medicina|energ[ií]a limpia|bater[ií]a|agua|conservaci[oó]n|accesibilidad|agricultura)\b/i,
    ],
};

const politicalPatterns = [
    /\b(?:election|electoral|voter|voters|voting|campaign|referendum|politics|political|partisan)\b/i,
    /\b(?:president|prime minister|parliament|congress|senate|senator|lawmaker|legislature|cabinet)\b/i,
    /\b(?:democrat|republican|labour party|conservative party)\b/i,
    /\b(?:candidate|candidates)\b.{0,36}\b(?:election|president|mayor|senate|congress|office|vote|campaign)\b/i,
    /\b(?:government|governor|mayor)\b.{0,28}\b(?:policy|bill|law|ban|tax|election|vote|campaign|administration)\b/i,
    /\b(?:policy|legislation|court ruling|supreme court)\b/i,
    /\b(?:elecci[oó]n|elecciones|electoral|votantes?|votaci[oó]n|campa[ñn]a|refer[eé]ndum|pol[ií]tica|pol[ií]tico|partidario)\b/i,
    /\b(?:presidente|primer ministro|parlamento|congreso|senado|senador|diputad[oa]|legislatura|gabinete)\b/i,
    /\b(?:candidat[oa]s?)\b.{0,38}\b(?:elecci[oó]n|presidente|alcalde|intendente|senado|congreso|cargo|voto|campa[ñn]a)\b/i,
    /\b(?:gobierno|gobernador|alcalde|intendente)\b.{0,30}\b(?:pol[ií]tica|ley|impuesto|elecci[oó]n|voto|campa[ñn]a|administraci[oó]n)\b/i,
    /\b(?:legislaci[oó]n|corte suprema|tribunal supremo)\b/i,
];

const sportsPatterns = [
    /\b(?:football|soccer|basketball|baseball|tennis|golf|rugby|cricket|hockey|nba|nfl|mlb|nhl|fifa|uefa|olympic|olympics)\b/i,
    /\b(?:athlete|coach|tournament|championship|playoffs?|grand slam|world cup|premier league|champions league|formula ?1|f1)\b/i,
    /\b(?:f[uú]tbol|b[aá]squet|baloncesto|b[eé]isbol|tenis|golf|rugby|hockey|ol[ií]mpic[oa]s?|torneo|campeonato|mundial|copa del mundo|f[oó]rmula ?1)\b/i,
];

const tragedyPatterns = [
    /\b(?:massacre|shooting|murder|hostage|airstrike|bombing|missile|sexual assault|rape)\b/i,
    /\b(?:masacre|tiroteo|asesinato|reh[eé]n|bombardeo|misil|agresi[oó]n sexual|violaci[oó]n)\b/i,
];

const matchesAny = (patterns, text = '') =>
    Boolean(text) && patterns.some((pattern) => pattern.test(text));

const hasPositiveResolution = (text = '') =>
    matchesAny(positiveResolutionHeadlinePatterns, text) ||
    matchesAny(strongOutcomePatterns, text);

export const hasDisqualifyingSignal = (text, title = text, deck = '') => {
    const positiveResolution = hasPositiveResolution(`${title} ${deck}`);

    if (matchesAny(hardNegativeHeadlinePatterns, title)) return true;
    if (matchesAny(severeNegativeHeadlinePatterns, title)) return true;
    if (
        matchesAny(mortalityHeadlinePatterns, `${title} ${deck}`) &&
        !positiveResolution
    ) return true;
    if (matchesAny(militaryWeaponsPatterns, `${title} ${deck}`)) return true;
    if (matchesAny(mixedOutcomePatterns, `${title} ${deck}`)) return true;
    if (matchesAny(geopoliticalPatterns, `${title} ${deck}`)) return true;

    if (
        matchesAny(endangeredProblemPatterns, `${title} ${deck}`) &&
        !positiveResolution
    ) {
        return true;
    }

    if (
        matchesAny(dominantNegativeHeadlinePatterns, title) &&
        !positiveResolution
    ) {
        return true;
    }

    if (
        matchesAny(advocacyOnlyHeadlinePatterns, `${title} ${deck}`) &&
        !positiveResolution
    ) {
        return true;
    }

    const contextualNegative = matchesAny(
        contextualNegativeHeadlinePatterns,
        title,
    );
    if (contextualNegative && !positiveResolution) return true;

    // The deck/subtitle describes the actual outcome more reliably than isolated
    // words in the article excerpt. A clearly negative deck can veto a neutral
    // headline, unless title+deck explicitly describe a positive resolution.
    if (
        matchesAny(dominantNegativeContextPatterns, deck) &&
        !positiveResolution
    ) {
        return true;
    }

    return [...tragedyPatterns, ...politicalPatterns, ...sportsPatterns].some(
        (pattern) => pattern.test(text),
    );
};

export const hasQualifyingOutcome = ({
    title = '',
    deck = '',
    excerpt = '',
    category = 'society',
} = {}) => {
    const mainContext = `${title} ${deck}`.trim();
    const fullContext = `${mainContext} ${excerpt}`.trim();

    // GUD publishes outcomes, not proposals, conditional promises or generic
    // explainers. A later paragraph cannot convert these story types into GUD.
    if (matchesAny(conditionalFuturePatterns, title)) return false;

    const realizedInMain = matchesAny(genericRealizedOutcomePatterns, mainContext);
    const categoryPatterns = realizedOutcomeByCategory[category] ?? [];
    const categoryOutcome = matchesAny(categoryPatterns, mainContext);
    const publicBenefit = matchesAny(publicBenefitOutcomePatterns, mainContext);
    const spanishRealizedAction = matchesAny(
        spanishRealizedActionPatterns,
        mainContext,
    );
    const researchBackedKnowledgeGain =
        ['science', 'nature', 'health', 'technology'].includes(category) &&
        (category === 'science' ||
            matchesAny(spanishResearchCuePatterns, mainContext)) &&
        matchesAny(spanishScienceKnowledgeGainPatterns, mainContext) &&
        !matchesAny(spanishScienceKnowledgeVetoPatterns, mainContext);

    if (
        matchesAny(productLaunchPatterns, title) &&
        !publicBenefit &&
        !categoryOutcome
    ) {
        return false;
    }

    if (
        matchesAny(analysisExplainerPatterns, title) &&
        !realizedInMain &&
        !categoryOutcome
    ) {
        return false;
    }

    // Main editorial context must carry the positive outcome. We only use the
    // excerpt as supporting evidence for a category-specific pattern, never as
    // the sole reason to admit a story.
    if (
        realizedInMain ||
        categoryOutcome ||
        publicBenefit ||
        spanishRealizedAction ||
        researchBackedKnowledgeGain
    ) {
        return true;
    }

    // Rare fallback: some RSS decks are truncated, but a precise demonstrated
    // outcome may survive in the excerpt. Keep this deliberately narrow.
    return matchesAny(publicBenefitOutcomePatterns, fullContext);
};

export const hasPositiveOutcomeSignal = (text) => hasPositiveResolution(text);

const weightedScore = (text = '') => {
    if (!text) return 0;
    let score = 0;

    for (const [pattern, weight] of positivePatterns) {
        if (pattern.test(text)) score += weight;
    }

    for (const [pattern, weight] of negativePatterns) {
        if (pattern.test(text)) score += weight;
    }

    return score;
};

export const scoreGoodNews = (text, title = text, deck = '') => {
    const cleanDeck = deck && deck !== title ? deck : '';
    const residualText = text
        .replace(title, ' ')
        .replace(cleanDeck, ' ');

    // Editorial hierarchy: title 3x, deck/subtitle 2x, residual excerpt 1x.
    // This prevents a small secondary benefit from overpowering the main event.
    let score =
        weightedScore(title) * 3 +
        weightedScore(cleanDeck) * 2 +
        weightedScore(residualText);

    if (hasPositiveResolution(`${title} ${cleanDeck}`)) score += 3;

    if (matchesAny(dominantNegativeHeadlinePatterns, title)) score -= 12;
    if (matchesAny(dominantNegativeContextPatterns, cleanDeck)) score -= 8;

    return score;
};
