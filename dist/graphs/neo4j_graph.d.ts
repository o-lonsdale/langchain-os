interface Neo4jGraphConfig {
    url: string;
    username: string;
    password: string;
    database?: string;
}
export declare class Neo4jGraph {
    private driver;
    private database;
    private schema;
    constructor({ url, username, password, database, }: Neo4jGraphConfig);
    static initialize(config: Neo4jGraphConfig): Promise<Neo4jGraph>;
    getSchema(): string;
    query(query: string, params?: any): Promise<any[] | undefined>;
    verifyConnectivity(): Promise<void>;
    refreshSchema(): Promise<void>;
    close(): Promise<void>;
}
export {};
