window.BidLevels = (() => {
    const defaults = [{from: 0, step: 1000}, {from: 15000, step: 5000}, {from: 50000, step: 10000}];
    function minimum(current, levels = defaults) {
        const tier = [...(levels || defaults)].reverse().find(row => current >= row.from);
        return current + (tier || defaults[0]).step;
    }
    function validCustom(amount, minimumBid, maximum) {
        return Number.isSafeInteger(amount) && amount % 1000 === 0 && amount >= minimumBid && amount <= maximum;
    }
    function ask(minimumBid, maximum) {
        const value = window.prompt(`Enter a total bid in multiples of 1,000 (minimum ${minimumBid.toLocaleString()}, maximum ${maximum.toLocaleString()}).`, Math.ceil(minimumBid / 1000) * 1000);
        if (value === null) return null;
        const amount = Number(value);
        if (validCustom(amount, minimumBid, maximum)) return amount;
        window.alert('Enter a multiple of 1,000 within the allowed range.');
        return null;
    }
    return { defaults, minimum, validCustom, ask };
})();
