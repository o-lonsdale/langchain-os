import { coerceMessageLikeToMessage, } from "../schema/index.js";
import { AsyncCaller } from "../util/async_caller.js";
import { getModelNameForTiktoken } from "./count_tokens.js";
import { encodingForModel } from "../util/tiktoken.js";
import { Runnable } from "../schema/runnable/index.js";
import { StringPromptValue } from "../prompts/base.js";
import { ChatPromptValue } from "../prompts/chat.js";
import { InMemoryCache } from "../cache/index.js";
const getVerbosity = () => false;
/**
 * Base class for language models, chains, tools.
 */
export class BaseLangChain extends Runnable {
    get lc_attributes() {
        return {
            callbacks: undefined,
            verbose: undefined,
        };
    }
    constructor(params) {
        super(params);
        /**
         * Whether to print out response text.
         */
        Object.defineProperty(this, "verbose", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "callbacks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "tags", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "metadata", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.verbose = params.verbose ?? getVerbosity();
        this.callbacks = params.callbacks;
        this.tags = params.tags ?? [];
        this.metadata = params.metadata ?? {};
    }
}
/**
 * Base class for language models.
 */
export class BaseLanguageModel extends BaseLangChain {
    /**
     * Keys that the language model accepts as call options.
     */
    get callKeys() {
        return ["stop", "timeout", "signal", "tags", "metadata", "callbacks"];
    }
    constructor({ callbacks, callbackManager, ...params }) {
        super({
            callbacks: callbacks ?? callbackManager,
            ...params,
        });
        /**
         * The async caller should be used by subclasses to make any async calls,
         * which will thus benefit from the concurrency and retry logic.
         */
        Object.defineProperty(this, "caller", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_encoding", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        if (typeof params.cache === "object") {
            this.cache = params.cache;
        }
        else if (params.cache) {
            this.cache = InMemoryCache.global();
        }
        else {
            this.cache = undefined;
        }
        this.caller = new AsyncCaller(params ?? {});
    }
    async getNumTokens(text) {
        // fallback to approximate calculation if tiktoken is not available
        let numTokens = Math.ceil(text.length / 4);
        if (!this._encoding) {
            try {
                this._encoding = await encodingForModel("modelName" in this
                    ? getModelNameForTiktoken(this.modelName)
                    : "gpt2");
            }
            catch (error) {
                console.warn("Failed to calculate number of tokens, falling back to approximate count", error);
            }
        }
        if (this._encoding) {
            numTokens = this._encoding.encode(text).length;
        }
        return numTokens;
    }
    static _convertInputToPromptValue(input) {
        if (typeof input === "string") {
            return new StringPromptValue(input);
        }
        else if (Array.isArray(input)) {
            return new ChatPromptValue(input.map(coerceMessageLikeToMessage));
        }
        else {
            return input;
        }
    }
    /**
     * Get the identifying parameters of the LLM.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _identifyingParams() {
        return {};
    }
    /**
     * Create a unique cache key for a specific call to a specific language model.
     * @param callOptions Call options for the model
     * @returns A unique cache key.
     */
    _getSerializedCacheKeyParametersForCall(callOptions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const params = {
            ...this._identifyingParams(),
            ...callOptions,
            _type: this._llmType(),
            _model: this._modelType(),
        };
        const filteredEntries = Object.entries(params).filter(([_, value]) => value !== undefined);
        const serializedEntries = filteredEntries
            .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
            .sort()
            .join(",");
        return serializedEntries;
    }
    /**
     * @deprecated
     * Return a json-like object representing this LLM.
     */
    serialize() {
        return {
            ...this._identifyingParams(),
            _type: this._llmType(),
            _model: this._modelType(),
        };
    }
    /**
     * @deprecated
     * Load an LLM from a json-like object describing it.
     */
    static async deserialize(data) {
        const { _type, _model, ...rest } = data;
        if (_model && _model !== "base_chat_model") {
            throw new Error(`Cannot load LLM with model ${_model}`);
        }
        const Cls = {
            openai: (await import("../chat_models/openai.js")).ChatOpenAI,
        }[_type];
        if (Cls === undefined) {
            throw new Error(`Cannot load LLM with type ${_type}`);
        }
        return new Cls(rest);
    }
}
/*
 * Export utility functions for token calculations:
 * - calculateMaxTokens: Calculate max tokens for a given model and prompt (the model context size - tokens in prompt).
 * - getModelContextSize: Get the context size for a specific model.
 */
export { calculateMaxTokens, getModelContextSize } from "./count_tokens.js";
