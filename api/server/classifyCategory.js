const categoryPatterns = [
    {
        category: 'science',
        patterns: [
            /\bscient(?:ist|ists|ific|ifically)\b/i,
            /\bresearch(?:er|ers)?\b/i,
            /\bstudy\b/i,
            /\bdiscover(?:y|ed|ies)\b/i,
            /\bspace\b/i,
            /\bphysics\b/i,
            /\bastronom(?:y|er|ers)\b/i,
        ],
    },
    {
        category: 'planet',
        patterns: [
            /\bclimate\b/i,
            /\bforest(?:s)?\b/i,
            /\bocean(?:s)?\b/i,
            /\bcoral\b/i,
            /\brenewable\b/i,
            /\bsolar\b/i,
            /\bwind power\b/i,
            /\bconservation\b/i,
            /\bhabitat\b/i,
            /\benvironment(?:al)?\b/i,
        ],
    },
    {
        category: 'health',
        patterns: [
            /\bhealth\b/i,
            /\bmedical\b/i,
            /\bpatient(?:s)?\b/i,
            /\btreatment\b/i,
            /\bvaccine\b/i,
            /\bcancer\b/i,
            /\bdisease\b/i,
            /\btherapy\b/i,
            /\bhospital\b/i,
        ],
    },
    {
        category: 'animals',
        patterns: [
            /\banimal(?:s)?\b/i,
            /\bwildlife\b/i,
            /\bdog(?:s)?\b/i,
            /\bcat(?:s)?\b/i,
            /\bbird(?:s)?\b/i,
            /\bwhale(?:s)?\b/i,
            /\bdolphin(?:s)?\b/i,
            /\belephant(?:s)?\b/i,
            /\bspecies\b/i,
        ],
    },
    {
        category: 'technology',
        patterns: [
            /\btechnology\b/i,
            /\bengineer(?:s|ing)?\b/i,
            /\brobot(?:s|ics)?\b/i,
            /\bsoftware\b/i,
            /\bbattery\b/i,
            /\bcomputer\b/i,
            /\binvention\b/i,
        ],
    },
    {
        category: 'culture',
        patterns: [
            /\bart(?:ist|ists)?\b/i,
            /\bmusic(?:ian|ians)?\b/i,
            /\bfilm\b/i,
            /\bmuseum\b/i,
            /\bbook(?:s)?\b/i,
            /\bcultur(?:e|al)\b/i,
            /\barchitecture\b/i,
        ],
    },
    {
        category: 'people',
        patterns: [
            /\bcommunity\b/i,
            /\bneighbor(?:s|hood)?\b/i,
            /\bvolunteer(?:s|ed|ing)?\b/i,
            /\bteacher(?:s)?\b/i,
            /\bstudent(?:s)?\b/i,
            /\b(?:family|families)\b/i,
            /\bchildren\b/i,
        ],
    },
];
export const classifyCategory = (text, fallback) => {
    let bestCategory = fallback;
    let bestScore = 0;
    for (const rule of categoryPatterns) {
        const score = rule.patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0);
        if (score > bestScore) {
            bestScore = score;
            bestCategory = rule.category;
        }
    }
    return bestCategory;
};
