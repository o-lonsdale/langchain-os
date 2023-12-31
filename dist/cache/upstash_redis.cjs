"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpstashRedisCache = void 0;
const redis_1 = require("@upstash/redis");
const index_js_1 = require("../schema/index.cjs");
const base_js_1 = require("./base.cjs");
/**
 * A cache that uses Upstash as the backing store.
 * See https://docs.upstash.com/redis.
 */
class UpstashRedisCache extends index_js_1.BaseCache {
    constructor(props) {
        super();
        Object.defineProperty(this, "redisClient", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        const { config, client } = props;
        if (client) {
            this.redisClient = client;
        }
        else if (config) {
            this.redisClient = new redis_1.Redis(config);
        }
        else {
            throw new Error(`Upstash Redis caches require either a config object or a pre-configured client.`);
        }
    }
    /**
     * Lookup LLM generations in cache by prompt and associated LLM key.
     */
    async lookup(prompt, llmKey) {
        let idx = 0;
        let key = (0, base_js_1.getCacheKey)(prompt, llmKey, String(idx));
        let value = await this.redisClient.get(key);
        const generations = [];
        while (value) {
            generations.push((0, base_js_1.deserializeStoredGeneration)(value));
            idx += 1;
            key = (0, base_js_1.getCacheKey)(prompt, llmKey, String(idx));
            value = await this.redisClient.get(key);
        }
        return generations.length > 0 ? generations : null;
    }
    /**
     * Update the cache with the given generations.
     *
     * Note this overwrites any existing generations for the given prompt and LLM key.
     */
    async update(prompt, llmKey, value) {
        for (let i = 0; i < value.length; i += 1) {
            const key = (0, base_js_1.getCacheKey)(prompt, llmKey, String(i));
            await this.redisClient.set(key, JSON.stringify((0, base_js_1.serializeGeneration)(value[i])));
        }
    }
}
exports.UpstashRedisCache = UpstashRedisCache;
