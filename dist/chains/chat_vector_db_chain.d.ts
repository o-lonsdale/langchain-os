import { BaseLanguageModel } from "../base_language/index.js";
import { VectorStore } from "../vectorstores/base.js";
import { SerializedChatVectorDBQAChain } from "./serde.js";
import { ChainValues } from "../schema/index.js";
import { BaseChain, ChainInputs } from "./base.js";
import { LLMChain } from "./llm_chain.js";
import { CallbackManagerForChainRun } from "../callbacks/manager.js";
export type LoadValues = Record<string, any>;
/**
 * Interface for the input parameters of the ChatVectorDBQAChain class.
 */
export interface ChatVectorDBQAChainInput extends ChainInputs {
    vectorstore: VectorStore;
    combineDocumentsChain: BaseChain;
    questionGeneratorChain: LLMChain;
    returnSourceDocuments?: boolean;
    outputKey?: string;
    inputKey?: string;
    k?: number;
}
/** @deprecated use `ConversationalRetrievalQAChain` instead. */
export declare class ChatVectorDBQAChain extends BaseChain implements ChatVectorDBQAChainInput {
    k: number;
    inputKey: string;
    chatHistoryKey: string;
    get inputKeys(): string[];
    outputKey: string;
    get outputKeys(): string[];
    vectorstore: VectorStore;
    combineDocumentsChain: BaseChain;
    questionGeneratorChain: LLMChain;
    returnSourceDocuments: boolean;
    constructor(fields: ChatVectorDBQAChainInput);
    /** @ignore */
    _call(values: ChainValues, runManager?: CallbackManagerForChainRun): Promise<ChainValues>;
    _chainType(): "chat-vector-db";
    static deserialize(data: SerializedChatVectorDBQAChain, values: LoadValues): Promise<ChatVectorDBQAChain>;
    serialize(): SerializedChatVectorDBQAChain;
    /**
     * Creates an instance of ChatVectorDBQAChain using a BaseLanguageModel
     * and other options.
     * @param llm Instance of BaseLanguageModel used to generate a new question.
     * @param vectorstore Instance of VectorStore used for vector operations.
     * @param options (Optional) Additional options for creating the ChatVectorDBQAChain instance.
     * @returns New instance of ChatVectorDBQAChain.
     */
    static fromLLM(llm: BaseLanguageModel, vectorstore: VectorStore, options?: {
        inputKey?: string;
        outputKey?: string;
        k?: number;
        returnSourceDocuments?: boolean;
        questionGeneratorTemplate?: string;
        qaTemplate?: string;
        verbose?: boolean;
    }): ChatVectorDBQAChain;
}
