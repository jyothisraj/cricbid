/* Shared by the tournament admin, player catalogue and auction screens. */
window.PlayerCategories = (() => {
    const clean = value => String(value ?? '').trim();
    const textKey = value => clean(value).toLowerCase().replace(/\s+/g, ' ');
    const fieldKey = value => textKey(value).replace(/[^\p{L}\p{N}]/gu, '');
    const aliases = [
        ['dateofbirth','dob','birthdate'],
        ['playercategory','category'],
        ['battingposition','battingorder','position'],
        ['battingprofile','battingstyle'],
        ['bowlingprofile','bowlingstyle'],
        ['club', 'clubname', 'cricketclub'],
        ['cricketingprofile', 'cricketprofile', 'playingrole', 'playerrole', 'role'],
        ['areyouawicketkeeper', 'wicketkeeper', 'wicketkeeping', 'keeper', 'wk']
    ];

    function rawValue(player, field) {
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

function playerDay(value) {
    const text = String(value || '').trim();
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/.exec(text);
    const local = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
    if (!iso && !local) return '';
    const [year,month,day] = (iso ? iso.slice(1) : [local[3],local[2],local[1]]).map(Number);
    const date = new Date(Date.UTC(year,month-1,day));
    if (date.getUTCMonth() !== month-1 || date.getUTCDate() !== day) return '';
    return date.toISOString().slice(0,10);
}
function playerAge(dob, event) {
    const born = playerDay(dob);
    const cutoff = playerDay(event?.cutoffDate || event?.startDate);
    if (!born || !cutoff || born > cutoff) return '';
    return String(Number(cutoff.slice(0,4)) - Number(born.slice(0,4)) - Number(cutoff.slice(5) < born.slice(5)));
}
function playerHand(value) {
    return String(value || '').replace(/\bRH\b/gi,'Right Hand').replace(/\bLH\b/gi,'Left Hand');
}
function cricketRole(position, batting, bowling) {
    const order = String(position || batting || '').trim();
    const bowls = !/^(?:\s*|n\/?a|none|no|not applicable|does not bowl|none\s*\/\s*does not bowl|-)$/i.test(String(bowling || '').trim());
    if (/\b(?:top|middle)[\s-]*order\b/i.test(order)) return bowls ? 'All Rounder' : 'Batter';
    if (bowls && /\blower[\s-]*order\b/i.test(order)) return 'Bowler';
    return '';
}

    function fieldValue(player, field, event) {
        const key = fieldKey(field);
        const value = rawValue(player,field);
        if (key === 'age') return playerAge(rawValue(player,'DOB'),event) || value;
        if (aliases.find(group => group.includes('cricketingprofile')).includes(key)) {
            return cricketRole(rawValue(player,'Batting position'),rawValue(player,'Batting Profile'),rawValue(player,'Bowling Profile')) || value;
        }
        return ['battingprofile','bowlingprofile','battingstyle','bowlingstyle'].includes(key) ? playerHand(value) : value;
    }
    function matches(player, condition, event) {
        if (!condition?.field) return false;
        const actual = textKey(fieldValue(player, condition.field,event));
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
        for (const key of ['club','clubname','cricketclub']) {
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
                rule.conditions.every(condition => matches(player, condition,event)))
            .map(rule => rule.name);
        const allCategories = [...new Set([rawValue(player,"Player Category"), ...categories].filter(Boolean))];
        return { club, affiliation, matchedRules: categories, categories: allCategories, labels: [...new Set([affiliation || club, rawValue(player,"Player Category"), ...categories].filter(Boolean))] };
    }

    function badges(player, event, escapeText) {
        return classify(player, event).labels.map(label =>
            `<span class="pdl-badge pdl-badge-role">${escapeText(label)}</span>`).join(' ');
    }
    const nameOrder = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });
    function compareNames(a, b) {
        return nameOrder.compare(clean(a), clean(b));
    }
    return { compareNames, fieldValue, classify, badges, playerDay, playerAge, cricketRole };
})();
