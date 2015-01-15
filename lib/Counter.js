// Based on python's itertools.count(N)
var Counter = (function () {
    function Counter(initial) {
        var _this = this;
        this._current = (initial == null) ? 1 : initial;
        this.next = function () { return _this._current++; };
    }
    return Counter;
})();
exports.Counter = Counter;
//# sourceMappingURL=Counter.js.map