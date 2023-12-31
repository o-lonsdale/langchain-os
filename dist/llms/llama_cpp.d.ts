import { LlamaModel, LlamaContext, LlamaChatSession } from "node-llama-cpp";
import { LLM, BaseLLMCallOptions, BaseLLMParams } from "./base.js";
/**
 * Note that the modelPath is the only required parameter. For testing you
 * can set this in the environment variable `LLAMA_PATH`.
 */
export interface LlamaCppInputs extends BaseLLMParams {
    /** Prompt processing batch size. */
    batchSize?: number;
    /** Text context size. */
    contextSize?: number;
    /** Embedding mode only. */
    embedding?: boolean;
    /** Use fp16 for KV cache. */
    f16Kv?: boolean;
    /** Number of layers to store in VRAM. */
    gpuLayers?: number;
    /** The llama_eval() call computes all logits, not just the last one. */
    logitsAll?: boolean;
    /** If true, reduce VRAM usage at the cost of performance. */
    lowVram?: boolean;
    /** Path to the model on the filesystem. */
    modelPath: string;
    /** If null, a random seed will be used. */
    seed?: null | number;
    /** The randomness of the responses, e.g. 0.1 deterministic, 1.5 creative, 0.8 balanced, 0 disables. */
    temperature?: number;
    /** Consider the n most likely tokens, where n is 1 to vocabulary size, 0 disables (uses full vocabulary). Note: only applies when `temperature` > 0. */
    topK?: number;
    /** Selects the smallest token set whose probability exceeds P, where P is between 0 - 1, 1 disables. Note: only applies when `temperature` > 0. */
    topP?: number;
    /** Force system to keep model in RAM. */
    useMlock?: boolean;
    /** Use mmap if possible. */
    useMmap?: boolean;
    /** Only load the vocabulary, no weights. */
    vocabOnly?: boolean;
}
export interface LlamaCppCallOptions extends BaseLLMCallOptions {
    /** The maximum number of tokens the response should contain. */
    maxTokens?: number;
    /** A function called when matching the provided token array */
    onToken?: (tokens: number[]) => void;
}
/**
 *  To use this model you need to have the `node-llama-cpp` module installed.
 *  This can be installed using `npm install -S node-llama-cpp` and the minimum
 *  version supported in version 2.0.0.
 *  This also requires that have a locally built version of Llama2 installed.
 */
export declare class LlamaCpp extends LLM<LlamaCppCallOptions> {
    CallOptions: LlamaCppCallOptions;
    static inputs: LlamaCppInputs;
    batchSize?: number;
    contextSize?: number;
    embedding?: boolean;
    f16Kv?: boolean;
    gpuLayers?: number;
    logitsAll?: boolean;
    lowVram?: boolean;
    seed?: null | number;
    useMlock?: boolean;
    useMmap?: boolean;
    vocabOnly?: boolean;
    modelPath: string;
    _model: LlamaModel;
    _context: LlamaContext;
    _session: LlamaChatSession;
    static lc_name(): string;
    constructor(inputs: LlamaCppInputs);
    _llmType(): string;
    /** @ignore */
    _call(prompt: string, options?: this["ParsedCallOptions"]): Promise<string>;
}
