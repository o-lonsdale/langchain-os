import { AIMessage, HumanMessage, RUN_KEY, coerceMessageLikeToMessage, } from "../schema/index.js";
import { BaseLanguageModel, } from "../base_language/index.js";
import { CallbackManager, } from "../callbacks/manager.js";
/**
 * Creates a transform stream for encoding chat message chunks.
 * @deprecated Use {@link BytesOutputParser} instead
 * @returns A TransformStream instance that encodes chat message chunks.
 */
export function createChatMessageChunkEncoderStream() {
    const textEncoder = new TextEncoder();
    return new TransformStream({
        transform(chunk, controller) {
            controller.enqueue(textEncoder.encode(chunk.content));
        },
    });
}
/**
 * Base class for chat models. It extends the BaseLanguageModel class and
 * provides methods for generating chat based on input messages.
 */
export class BaseChatModel extends BaseLanguageModel {
    constructor(fields) {
        super(fields);
        Object.defineProperty(this, "lc_namespace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ["langchain", "chat_models", this._llmType()]
        });
    }
    _separateRunnableConfigFromCallOptions(options) {
        const [runnableConfig, callOptions] = super._separateRunnableConfigFromCallOptions(options);
        if (callOptions?.timeout && !callOptions.signal) {
            callOptions.signal = AbortSignal.timeout(callOptions.timeout);
        }
        return [runnableConfig, callOptions];
    }
    /**
     * Invokes the chat model with a single input.
     * @param input The input for the language model.
     * @param options The call options.
     * @returns A Promise that resolves to a BaseMessageChunk.
     */
    async invoke(input, options) {
        const promptValue = BaseChatModel._convertInputToPromptValue(input);
        const result = await this.generatePrompt([promptValue], options, options?.callbacks);
        const chatGeneration = result.generations[0][0];
        // TODO: Remove cast after figuring out inheritance
        return chatGeneration.message;
    }
    // eslint-disable-next-line require-yield
    async *_streamResponseChunks(_messages, _options, _runManager) {
        throw new Error("Not implemented.");
    }
    async *_streamIterator(input, options) {
        // Subclass check required to avoid double callbacks with default implementation
        if (this._streamResponseChunks ===
            BaseChatModel.prototype._streamResponseChunks) {
            yield this.invoke(input, options);
        }
        else {
            const prompt = BaseChatModel._convertInputToPromptValue(input);
            const messages = prompt.toChatMessages();
            const [runnableConfig, callOptions] = this._separateRunnableConfigFromCallOptions(options);
            const callbackManager_ = await CallbackManager.configure(runnableConfig.callbacks, this.callbacks, runnableConfig.tags, this.tags, runnableConfig.metadata, this.metadata, { verbose: this.verbose });
            const extra = {
                options: callOptions,
                invocation_params: this?.invocationParams(callOptions),
            };
            const runManagers = await callbackManager_?.handleChatModelStart(this.toJSON(), [messages], undefined, undefined, extra, undefined, undefined, runnableConfig.runName);
            let generationChunk;
            try {
                for await (const chunk of this._streamResponseChunks(messages, callOptions, runManagers?.[0])) {
                    yield chunk.message;
                    if (!generationChunk) {
                        generationChunk = chunk;
                    }
                    else {
                        generationChunk = generationChunk.concat(chunk);
                    }
                }
            }
            catch (err) {
                await Promise.all((runManagers ?? []).map((runManager) => runManager?.handleLLMError(err)));
                throw err;
            }
            await Promise.all((runManagers ?? []).map((runManager) => runManager?.handleLLMEnd({
                // TODO: Remove cast after figuring out inheritance
                generations: [[generationChunk]],
            })));
        }
    }
    /** @ignore */
    async _generateUncached(messages, parsedOptions, handledOptions) {
        const baseMessages = messages.map((messageList) => messageList.map(coerceMessageLikeToMessage));
        // create callback manager and start run
        const callbackManager_ = await CallbackManager.configure(handledOptions.callbacks, this.callbacks, handledOptions.tags, this.tags, handledOptions.metadata, this.metadata, { verbose: this.verbose });
        const extra = {
            options: parsedOptions,
            invocation_params: this?.invocationParams(parsedOptions),
        };
        const runManagers = await callbackManager_?.handleChatModelStart(this.toJSON(), baseMessages, undefined, undefined, extra, undefined, undefined, handledOptions.runName);
        // generate results
        const results = await Promise.allSettled(baseMessages.map((messageList, i) => this._generate(messageList, { ...parsedOptions, promptIndex: i }, runManagers?.[i])));
        // handle results
        const generations = [];
        const llmOutputs = [];
        await Promise.all(results.map(async (pResult, i) => {
            if (pResult.status === "fulfilled") {
                const result = pResult.value;
                generations[i] = result.generations;
                llmOutputs[i] = result.llmOutput;
                return runManagers?.[i]?.handleLLMEnd({
                    generations: [result.generations],
                    llmOutput: result.llmOutput,
                });
            }
            else {
                // status === "rejected"
                await runManagers?.[i]?.handleLLMError(pResult.reason);
                return Promise.reject(pResult.reason);
            }
        }));
        // create combined output
        const output = {
            generations,
            llmOutput: llmOutputs.length
                ? this._combineLLMOutput?.(...llmOutputs)
                : undefined,
        };
        Object.defineProperty(output, RUN_KEY, {
            value: runManagers
                ? { runIds: runManagers?.map((manager) => manager.runId) }
                : undefined,
            configurable: true,
        });
        return output;
    }
    /**
     * Generates chat based on the input messages.
     * @param messages An array of arrays of BaseMessage instances.
     * @param options The call options or an array of stop sequences.
     * @param callbacks The callbacks for the language model.
     * @returns A Promise that resolves to an LLMResult.
     */
    async generate(messages, options, callbacks) {
        // parse call options
        let parsedOptions;
        if (Array.isArray(options)) {
            parsedOptions = { stop: options };
        }
        else {
            parsedOptions = options;
        }
        const baseMessages = messages.map((messageList) => messageList.map(coerceMessageLikeToMessage));
        const [runnableConfig, callOptions] = this._separateRunnableConfigFromCallOptions(parsedOptions);
        runnableConfig.callbacks = runnableConfig.callbacks ?? callbacks;
        if (!this.cache) {
            return this._generateUncached(baseMessages, callOptions, runnableConfig);
        }
        const { cache } = this;
        const llmStringKey = this._getSerializedCacheKeyParametersForCall(callOptions);
        const missingPromptIndices = [];
        const generations = await Promise.all(baseMessages.map(async (baseMessage, index) => {
            // Join all content into one string for the prompt index
            const prompt = BaseChatModel._convertInputToPromptValue(baseMessage).toString();
            const result = await cache.lookup(prompt, llmStringKey);
            if (!result) {
                missingPromptIndices.push(index);
            }
            return result;
        }));
        let llmOutput = {};
        if (missingPromptIndices.length > 0) {
            const results = await this._generateUncached(missingPromptIndices.map((i) => baseMessages[i]), callOptions, runnableConfig);
            await Promise.all(results.generations.map(async (generation, index) => {
                const promptIndex = missingPromptIndices[index];
                generations[promptIndex] = generation;
                // Join all content into one string for the prompt index
                const prompt = BaseChatModel._convertInputToPromptValue(baseMessages[promptIndex]).toString();
                return cache.update(prompt, llmStringKey, generation);
            }));
            llmOutput = results.llmOutput ?? {};
        }
        return { generations, llmOutput };
    }
    /**
     * Get the parameters used to invoke the model
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invocationParams(_options) {
        return {};
    }
    _modelType() {
        return "base_chat_model";
    }
    /**
     * @deprecated
     * Return a json-like object representing this LLM.
     */
    serialize() {
        return {
            ...this.invocationParams(),
            _type: this._llmType(),
            _model: this._modelType(),
        };
    }
    /**
     * Generates a prompt based on the input prompt values.
     * @param promptValues An array of BasePromptValue instances.
     * @param options The call options or an array of stop sequences.
     * @param callbacks The callbacks for the language model.
     * @returns A Promise that resolves to an LLMResult.
     */
    async generatePrompt(promptValues, options, callbacks) {
        const promptMessages = promptValues.map((promptValue) => promptValue.toChatMessages());
        return this.generate(promptMessages, options, callbacks);
    }
    /**
     * Makes a single call to the chat model.
     * @param messages An array of BaseMessage instances.
     * @param options The call options or an array of stop sequences.
     * @param callbacks The callbacks for the language model.
     * @returns A Promise that resolves to a BaseMessage.
     */
    async call(messages, options, callbacks) {
        const result = await this.generate([messages.map(coerceMessageLikeToMessage)], options, callbacks);
        const generations = result.generations;
        return generations[0][0].message;
    }
    /**
     * Makes a single call to the chat model with a prompt value.
     * @param promptValue The value of the prompt.
     * @param options The call options or an array of stop sequences.
     * @param callbacks The callbacks for the language model.
     * @returns A Promise that resolves to a BaseMessage.
     */
    async callPrompt(promptValue, options, callbacks) {
        const promptMessages = promptValue.toChatMessages();
        return this.call(promptMessages, options, callbacks);
    }
    /**
     * Predicts the next message based on the input messages.
     * @param messages An array of BaseMessage instances.
     * @param options The call options or an array of stop sequences.
     * @param callbacks The callbacks for the language model.
     * @returns A Promise that resolves to a BaseMessage.
     */
    async predictMessages(messages, options, callbacks) {
        return this.call(messages, options, callbacks);
    }
    /**
     * Predicts the next message based on a text input.
     * @param text The text input.
     * @param options The call options or an array of stop sequences.
     * @param callbacks The callbacks for the language model.
     * @returns A Promise that resolves to a string.
     */
    async predict(text, options, callbacks) {
        const message = new HumanMessage(text);
        const result = await this.call([message], options, callbacks);
        return result.content;
    }
}
/**
 * An abstract class that extends BaseChatModel and provides a simple
 * implementation of _generate.
 */
export class SimpleChatModel extends BaseChatModel {
    async _generate(messages, options, runManager) {
        const text = await this._call(messages, options, runManager);
        const message = new AIMessage(text);
        return {
            generations: [
                {
                    text: message.content,
                    message,
                },
            ],
        };
    }
}
