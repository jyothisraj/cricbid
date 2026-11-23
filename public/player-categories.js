/* Shared by the tournament admin, player catalogue and auction screens. */
window.PlayerCategories = (() => {
    const clean = value => String(value ?? '').trim();
    const textKey = value => clean(value).toLowerCase().replace(/\s+/g, ' ');
    const fieldKey = value => textKey(value).replace(/[^\p{L}\p{N}]/gu, '');
    const aliases = [
        ['club', 'clubname', 'cricketclub'],
        ['cricketingprofile', 'cricketprofile', 'playingrole', 'playerrole', 'role'],
        ['areyouawicketkeeper', 'wicketkeeper', 'wicketkeeping', 'keeper', 'wk']
    ];

    function fieldValue(player, field) {
        const key = fieldKey(field);
        const keys = [key, ...(aliases.find(group => group.includes(key)) || [])];
        const entries = [...Object.entries(player || {}), ...Object.entries(player?.details || {})];
        for (const candidate of keys) {
            const entry = entries.find(([header, value]) =>
                fieldKey(header) === candidate && value != null && typeof value !== 'object' && clean(value) !== '');
            if (entry) return clean(entry[1]);
        }
        return '';
    }

    function matches(player, condition) {
        if (!condition?.field) return false;
        const actual = textKey(fieldValue(player, condition.field));
        if (!actual) return false;
        if (condition.operator === 'filled') return true;
        const expected = textKey(condition.value);
        if (!expected) return false;
        switch (condition.operator) {
            case 'equals': return actual === expected;
            case 'contains': return actual.includes(expected);
            case 'different': return actual !== expected;
            case 'min':
            case 'max': {
                const number = Number(actual);
                const limit = Number(expected);
                if (!Number.isFinite(number) || !Number.isFinite(limit)) return false;
                return condition.operator === 'min' ? number >= limit : number <= limit;
            }
            default: return false;
        }
    }

    function classify(player, event) {
        // Older registrations used the Club column for affiliation markers.
        const entries = [...Object.entries(player || {}), ...Object.entries(player?.details || {})];
        let club = '';
        for (const key of aliases[0]) {
            const entry = entries.find(([header, value]) => fieldKey(header) === key &&
                typeof value === 'string' && clean(value) && !/^(home|away)( club)?$/i.test(clean(value)));
            if (entry) {
                club = clean(entry[1]);
                break;
            }
        }
        const host = textKey(event?.hostClub);
        const affiliation = host ? (textKey(club) === host ? 'Home' : 'Away') : '';
        const categories = (Array.isArray(event?.playerCategories) ? event.playerCategories : [])
            .filter(rule => rule?.name && Array.isArray(rule.conditions) && rule.conditions.length &&
                rule.conditions.every(condition => matches(player, condition)))
            .map(rule => rule.name);
        return { club, affiliation, categories, labels: [affiliation || club, ...categories].filter(Boolean) };
    }

    function badges(player, event, escapeText) {
        return classify(player, event).labels.map(label =>
            `<span class="pdl-badge pdl-badge-role">${escapeText(label)}</span>`).join(' ');
    }
    return { fieldValue, classify, badges };
})();
