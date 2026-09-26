const categoryPatterns = [
    {
        category: 'health',
        patterns: [
            /\b(?:health|medical|medicine|patient|patients|treatment|therapy|vaccine|drug|cancer|disease|hospital|clinic|diagnosis)\b/i,
            /\b(?:salud|m[eé]dic[oa]s?|medicina|pacientes?|tratamiento|terapia|vacuna|f[aá]rmaco|c[aá]ncer|enfermedad|hospital|cl[ií]nica|diagn[oó]stico)\b/i,
        ],
    },
    {
        category: 'nature',
        patterns: [
            /\b(?:climate|forest|forests|ocean|oceans|coral|reef|renewable|solar|wind power|conservation|habitat|environment|environmental|wildlife|species|biodiversity|ecosystem|wetland|pollution)\b/i,
            /\b(?:clima|bosques?|oc[eé]anos?|coral|arrecife|renovable|solar|e[oó]lica|conservaci[oó]n|h[aá]bitat|ambiente|ambiental|fauna|especies|biodiversidad|ecosistema|humedal|contaminaci[oó]n)\b/i,
        ],
    },
    {
        category: 'education',
        patterns: [
            /\b(?:education|educational|school|schools|teacher|teachers|student|students|classroom|literacy|scholarship|learning|curriculum)\b/i,
            /\b(?:educaci[oó]n|educativo|educativa|escuela|escuelas|colegio|docentes?|maestros?|estudiantes?|aula|alfabetizaci[oó]n|beca|aprendizaje|curr[ií]culo)\b/i,
        ],
    },
    {
        category: 'technology',
        patterns: [
            /\b(?:technology|tech|engineer|engineers|engineering|robot|robotics|software|hardware|battery|computer|computing|invention|device|artificial intelligence|ai)\b/i,
            /\b(?:tecnolog[ií]a|tecnol[oó]gico|ingenier[ií]a|ingenier[oa]s?|robot|rob[oó]tica|software|hardware|bater[ií]a|computaci[oó]n|ordenador|computadora|invento|dispositivo|inteligencia artificial)\b/i,
        ],
    },
    {
        category: 'culture',
        patterns: [
            /\b(?:art|artist|artists|music|musician|film|cinema|museum|book|books|literature|culture|cultural|architecture|heritage|archive|library|theatre|theater)\b/i,
            /\b(?:arte|artistas?|m[uú]sica|m[uú]sicos?|cine|pel[ií]cula|museo|libros?|literatura|cultura|cultural|arquitectura|patrimonio|archivo|biblioteca|teatro)\b/i,
        ],
    },
    {
        category: 'community',
        patterns: [
            /\b(?:community|communities|neighbour|neighbor|neighborhood|volunteer|volunteers|local residents|families|children|charity|donation|mutual aid|community centre|community center)\b/i,
            /\b(?:comunidad|comunidades|vecinos?|barrio|barrios|voluntarios?|residentes|familias|ni[ñn]os?|solidaridad|donaci[oó]n|ayuda mutua|centro comunitario)\b/i,
        ],
    },
    {
        category: 'society',
        patterns: [
            /\b(?:society|social|housing|homelessness|poverty|public transport|transit|accessibility|disability|inclusion|inequality|public safety|infrastructure|human rights)\b/i,
            /\b(?:sociedad|social|vivienda|sinhogarismo|pobreza|transporte p[uú]blico|accesibilidad|discapacidad|inclusi[oó]n|desigualdad|seguridad p[uú]blica|infraestructura|derechos humanos)\b/i,
        ],
    },
    {
        category: 'science',
        patterns: [
            /\b(?:scientist|scientists|scientific|research|researcher|researchers|study|discovery|discovered|space|physics|astronomy|astronomer|biology|chemistry|archaeology|fossil)\b/i,
            /\b(?:cient[ií]fic[oa]s?|investigaci[oó]n|investigadores?|estudio|descubrimiento|descubren|espacio|f[ií]sica|astronom[ií]a|astr[oó]nom[oa]s?|biolog[ií]a|qu[ií]mica|arqueolog[ií]a|f[oó]sil)\b/i,
        ],
    },
];

export const classifyCategory = (text, fallback = 'society') => {
    let bestCategory = fallback;
    let bestScore = 0;

    for (const rule of categoryPatterns) {
        const score = rule.patterns.reduce(
            (total, pattern) => total + (pattern.test(text) ? 1 : 0),
            0,
        );

        if (score > bestScore) {
            bestScore = score;
            bestCategory = rule.category;
        }
    }

    return bestCategory;
};
