"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeGeneration = exports.deserializeStoredGeneration = exports.getCacheKey = void 0;
const object_hash_1 = __importDefault(require("object-hash"));
const index_js_1 = require("../schema/index.cjs");
/**
 * This cache key should be consistent across all versions of langchain.
 * It is currently NOT consistent across versions of langchain.
 *
 * A huge benefit of having a remote cache (like redis) is that you can
 * access the cache from different processes/machines. The allows you to
 * seperate concerns and scale horizontally.
 *
 * TODO: Make cache key consistent across versions of langchain.
 */
const getCacheKey = (...strings) => (0, object_hash_1.default)(strings.join("_"));
exports.getCacheKey = getCacheKey;
function deserializeStoredGeneration(storedGeneration) {
    if (storedGeneration.message !== undefined) {
        return {
            text: storedGeneration.text,
            message: (0, index_js_1.mapStoredMessageToChatMessage)(storedGeneration.message),
        };
    }
    else {
        return { text: storedGeneration.text };
    }
}
exports.deserializeStoredGeneration = deserializeStoredGeneration;
function serializeGeneration(generation) {
    const serializedValue = {
        text: generation.text,
    };
    if (generation.message !== undefined) {
        serializedValue.message = generation.message.toDict();
    }
    return serializedValue;
}
exports.serializeGeneration = serializeGeneration;
