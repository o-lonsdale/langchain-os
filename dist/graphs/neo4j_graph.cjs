"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Neo4jGraph = void 0;
const neo4j_driver_1 = __importDefault(require("neo4j-driver"));
class Neo4jGraph {
    constructor({ url, username, password, database = "neo4j", }) {
        Object.defineProperty(this, "driver", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "database", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "schema", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ""
        });
        try {
            this.driver = neo4j_driver_1.default.driver(url, neo4j_driver_1.default.auth.basic(username, password));
            this.database = database;
        }
        catch (error) {
            throw new Error("Could not create a Neo4j driver instance. Please check the connection details.");
        }
    }
    static async initialize(config) {
        const graph = new Neo4jGraph(config);
        try {
            await graph.verifyConnectivity();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }
        catch (error) {
            console.log("Failed to verify connection.");
        }
        try {
            await graph.refreshSchema();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }
        catch (error) {
            throw new Error(`Error: ${error.message}`);
        }
        finally {
            console.log("Schema refreshed successfully.");
        }
        return graph;
    }
    getSchema() {
        return this.schema;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async query(query, params = {}) {
        try {
            const result = await this.driver.executeQuery(query, params, {
                database: this.database,
            });
            return toObjects(result.records);
        }
        catch (error) {
            // ignore errors
        }
        return undefined;
    }
    async verifyConnectivity() {
        await this.driver.verifyAuthentication();
    }
    async refreshSchema() {
        const nodePropertiesQuery = `
      CALL apoc.meta.data()
      YIELD label, other, elementType, type, property
      WHERE NOT type = "RELATIONSHIP" AND elementType = "node"
      WITH label AS nodeLabels, collect({property:property, type:type}) AS properties
      RETURN {labels: nodeLabels, properties: properties} AS output
    `;
        const relPropertiesQuery = `
      CALL apoc.meta.data()
      YIELD label, other, elementType, type, property
      WHERE NOT type = "RELATIONSHIP" AND elementType = "relationship"
      WITH label AS nodeLabels, collect({property:property, type:type}) AS properties
      RETURN {type: nodeLabels, properties: properties} AS output
    `;
        const relQuery = `
      CALL apoc.meta.data()
      YIELD label, other, elementType, type, property
      WHERE type = "RELATIONSHIP" AND elementType = "node"
      UNWIND other AS other_node
      RETURN "(:" + label + ")-[:" + property + "]->(:" + toString(other_node) + ")" AS output
    `;
        const nodeProperties = await this.query(nodePropertiesQuery);
        const relationshipsProperties = await this.query(relPropertiesQuery);
        const relationships = await this.query(relQuery);
        this.schema = `
      Node properties are the following:
      ${JSON.stringify(nodeProperties?.map((el) => el.output))}

      Relationship properties are the following:
      ${JSON.stringify(relationshipsProperties?.map((el) => el.output))}

      The relationships are the following:
      ${JSON.stringify(relationships?.map((el) => el.output))}
    `;
    }
    async close() {
        await this.driver.close();
    }
}
exports.Neo4jGraph = Neo4jGraph;
function toObjects(records) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recordValues = records.map((record) => {
        const rObj = record.toObject();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const out = {};
        Object.keys(rObj).forEach((key) => {
            out[key] = itemIntToString(rObj[key]);
        });
        return out;
    });
    return recordValues;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function itemIntToString(item) {
    if (neo4j_driver_1.default.isInt(item))
        return item.toString();
    if (Array.isArray(item))
        return item.map((ii) => itemIntToString(ii));
    if (["number", "string", "boolean"].indexOf(typeof item) !== -1)
        return item;
    if (item === null)
        return item;
    if (typeof item === "object")
        return objIntToString(item);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function objIntToString(obj) {
    const entry = extractFromNeoObjects(obj);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let newObj = null;
    if (Array.isArray(entry)) {
        newObj = entry.map((item) => itemIntToString(item));
    }
    else if (entry !== null && typeof entry === "object") {
        newObj = {};
        Object.keys(entry).forEach((key) => {
            newObj[key] = itemIntToString(entry[key]);
        });
    }
    return newObj;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFromNeoObjects(obj) {
    if (
    // eslint-disable-next-line
    obj instanceof neo4j_driver_1.default.types.Node ||
        // eslint-disable-next-line
        obj instanceof neo4j_driver_1.default.types.Relationship) {
        return obj.properties;
        // eslint-disable-next-line
    }
    else if (obj instanceof neo4j_driver_1.default.types.Path) {
        // eslint-disable-next-line
        return [].concat.apply([], extractPathForRows(obj));
    }
    return obj;
}
const extractPathForRows = (path) => {
    let { segments } = path;
    // Zero length path. No relationship, end === start
    if (!Array.isArray(path.segments) || path.segments.length < 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        segments = [{ ...path, end: null }];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return segments.map((segment) => [
        objIntToString(segment.start),
        objIntToString(segment.relationship),
        objIntToString(segment.end),
    ].filter((part) => part !== null));
};
