/* eslint-disable prefer-template */
import { Client as CassandraClient } from "cassandra-driver";
import { VectorStore } from "./base.js";
import { Document } from "../document.js";
/**
 * Class for interacting with the Cassandra database. It extends the
 * VectorStore class and provides methods for adding vectors and
 * documents, searching for similar vectors, and creating instances from
 * texts or documents.
 */
export class CassandraStore extends VectorStore {
    _vectorstoreType() {
        return "cassandra";
    }
    constructor(embeddings, args) {
        super(embeddings, args);
        Object.defineProperty(this, "client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "dimensions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "keyspace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "primaryKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "metadataColumns", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "table", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isInitialized", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.client = new CassandraClient(args);
        this.dimensions = args.dimensions;
        this.keyspace = args.keyspace;
        this.table = args.table;
        this.primaryKey = args.primaryKey;
        this.metadataColumns = args.metadataColumns;
    }
    /**
     * Method to save vectors to the Cassandra database.
     * @param vectors Vectors to save.
     * @param documents The documents associated with the vectors.
     * @returns Promise that resolves when the vectors have been added.
     */
    async addVectors(vectors, documents) {
        if (vectors.length === 0) {
            return;
        }
        if (!this.isInitialized) {
            await this.initialize();
        }
        const queries = this.buildInsertQuery(vectors, documents);
        await this.client.batch(queries);
    }
    /**
     * Method to add documents to the Cassandra database.
     * @param documents The documents to add.
     * @returns Promise that resolves when the documents have been added.
     */
    async addDocuments(documents) {
        return this.addVectors(await this.embeddings.embedDocuments(documents.map((d) => d.pageContent)), documents);
    }
    /**
     * Method to search for vectors that are similar to a given query vector.
     * @param query The query vector.
     * @param k The number of similar vectors to return.
     * @returns Promise that resolves with an array of tuples, each containing a Document and a score.
     */
    async similaritySearchVectorWithScore(query, k) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const queryStr = this.buildSearchQuery(query, k);
        const queryResultSet = await this.client.execute(queryStr);
        return queryResultSet?.rows.map((row, index) => {
            const textContent = row.text;
            const sanitizedRow = Object.assign(row, {});
            delete sanitizedRow.vector;
            delete sanitizedRow.text;
            return [
                new Document({ pageContent: textContent, metadata: sanitizedRow }),
                index,
            ];
        });
    }
    /**
     * Static method to create an instance of CassandraStore from texts.
     * @param texts The texts to use.
     * @param metadatas The metadata associated with the texts.
     * @param embeddings The embeddings to use.
     * @param args The arguments for the CassandraStore.
     * @returns Promise that resolves with a new instance of CassandraStore.
     */
    static async fromTexts(texts, metadatas, embeddings, args) {
        const docs = [];
        for (let index = 0; index < texts.length; index += 1) {
            const metadata = Array.isArray(metadatas) ? metadatas[index] : metadatas;
            const doc = new Document({
                pageContent: texts[index],
                metadata,
            });
            docs.push(doc);
        }
        return CassandraStore.fromDocuments(docs, embeddings, args);
    }
    /**
     * Static method to create an instance of CassandraStore from documents.
     * @param docs The documents to use.
     * @param embeddings The embeddings to use.
     * @param args The arguments for the CassandraStore.
     * @returns Promise that resolves with a new instance of CassandraStore.
     */
    static async fromDocuments(docs, embeddings, args) {
        const instance = new this(embeddings, args);
        await instance.addDocuments(docs);
        return instance;
    }
    /**
     * Static method to create an instance of CassandraStore from an existing
     * index.
     * @param embeddings The embeddings to use.
     * @param args The arguments for the CassandraStore.
     * @returns Promise that resolves with a new instance of CassandraStore.
     */
    static async fromExistingIndex(embeddings, args) {
        const instance = new this(embeddings, args);
        await instance.initialize();
        return instance;
    }
    /**
     * Method to initialize the Cassandra database.
     * @returns Promise that resolves when the database has been initialized.
     */
    async initialize() {
        await this.client.execute(`CREATE TABLE IF NOT EXISTS ${this.keyspace}.${this.table} (
      ${this.primaryKey.name} ${this.primaryKey.type} PRIMARY KEY,
      text TEXT,
      ${this.metadataColumns.length > 0
            ? this.metadataColumns.map((col) => `${col.name} ${col.type},`)
            : ""}
      vector VECTOR<FLOAT, ${this.dimensions}>
    );`);
        await this.client
            .execute(`CREATE CUSTOM INDEX IF NOT EXISTS idx_vector_${this.table}
  ON ${this.keyspace}.${this.table}(vector) USING 'StorageAttachedIndex';`);
        this.isInitialized = true;
    }
    /**
     * Method to build an CQL query for inserting vectors and documents into
     * the Cassandra database.
     * @param vectors The vectors to insert.
     * @param documents The documents to insert.
     * @returns The CQL query string.
     */
    buildInsertQuery(vectors, documents) {
        const queries = [];
        for (let index = 0; index < vectors.length; index += 1) {
            const vector = vectors[index];
            const document = documents[index];
            const metadataColNames = Object.keys(document.metadata);
            const metadataVals = Object.values(document.metadata);
            const metadataInsert = metadataColNames.length > 0 ? ", " + metadataColNames.join(", ") : "";
            const query = `INSERT INTO ${this.keyspace}.${this.table} (vector, text${metadataInsert}) VALUES ([${vector}], '${document.pageContent}'${metadataVals.length > 0
                ? ", " +
                    metadataVals
                        .map((val) => (typeof val === "number" ? val : `'${val}'`))
                        .join(", ")
                : ""});`;
            queries.push(query);
        }
        return queries;
    }
    /**
     * Method to build an CQL query for searching for similar vectors in the
     * Cassandra database.
     * @param query The query vector.
     * @param k The number of similar vectors to return.
     * @returns The CQL query string.
     */
    buildSearchQuery(query, k) {
        return `SELECT * FROM ${this.keyspace}.${this.table} ORDER BY vector ANN OF [${query}] LIMIT ${k || 1};`;
    }
}
