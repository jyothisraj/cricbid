window.PlayerPricing = (() => {
    function amount(value) {
        const number = Number(String(value ?? '').trim().replace(/^₹\s*/, '').replace(/,/g, ''));
        return Number.isFinite(number) && number > 0 ? number : null;
    }
    function entered(player) {
        for (const record of [player, player?.details]) {
            for (const [key, value] of Object.entries(record || {})) {
                if (/^(player)?base(price|value)$/i.test(key.replace(/[\s_-]/g, ''))) {
                    const price = amount(value);
                    if (price !== null) return price;
                }
            }
        }
        return null;
    }
    function resolve(player, tournament, defaultPrice) {
        return entered(player) ?? amount(tournament?.minPlayerValue) ?? amount(defaultPrice) ?? 10000;
    }
    return { entered, resolve };
})();
