/**
 * Based on Guava's LoadCache<K, V>.
 *
 * Why not extend Map?
 * Read https://code.google.com/p/guava-libraries/wiki/MapMakerMigration#MapMaker_and_ConcurrentMap
 */
var LoadingCache = (function () {
    function LoadingCache(loader) {
        this._map = new Map();
        this._loader = loader;
    }
    LoadingCache.prototype.get = function (key) {
        var value = this._map.get(key);
        if (value === void 0) {
            value = this._loader(key);
            this._map.set(key, value);
        }
        return value;
    };
    LoadingCache.prototype.asMap = function () {
        return this._map;
    };
    return LoadingCache;
})();
exports.LoadingCache = LoadingCache;
//# sourceMappingURL=LoadingCache.js.map