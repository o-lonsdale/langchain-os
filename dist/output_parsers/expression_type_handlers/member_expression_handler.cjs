"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemberExpressionHandler = void 0;
const base_js_1 = require("./base.cjs");
/**
 * Handles member expressions in the LangChain Expression Language (LCEL).
 * Extends the NodeHandler base class.
 */
class MemberExpressionHandler extends base_js_1.NodeHandler {
    /**
     * Checks if a given node is a member expression. If it is, the method
     * returns the node; otherwise, it returns false.
     * @param node The node to check.
     * @returns The node if it is a member expression, or false otherwise.
     */
    async accepts(node) {
        if (base_js_1.ASTParser.isMemberExpression(node)) {
            return node;
        }
        else {
            return false;
        }
    }
    /**
     * Processes a member expression node. It extracts the object and property
     * from the node, validates their types, and returns an object with the
     * type of the expression, the identifier, and the property.
     * @param node The member expression node to process.
     * @returns An object with the type of the expression, the identifier, and the property.
     */
    async handle(node) {
        if (!this.parentHandler) {
            throw new Error("ArrayLiteralExpressionHandler must have a parent handler");
        }
        const { object, property } = node;
        let prop;
        if (base_js_1.ASTParser.isIdentifier(property)) {
            prop = property.name.replace(/^["'](.+(?=["']$))["']$/, "$1");
        }
        else if (base_js_1.ASTParser.isStringLiteral(property)) {
            prop = `${property.value}`.replace(/^["'](.+(?=["']$))["']$/, "$1");
        }
        else {
            throw new Error("Invalid property key type");
        }
        let identifier;
        if (base_js_1.ASTParser.isIdentifier(object)) {
            identifier = object.name.replace(/^["'](.+(?=["']$))["']$/, "$1");
        }
        else if (base_js_1.ASTParser.isStringLiteral(object)) {
            identifier = `${object.value}`.replace(/^["'](.+(?=["']$))["']$/, "$1");
        }
        else {
            throw new Error("Invalid object type");
        }
        if (object.type !== "Identifier" && object.type !== "StringLiteral") {
            throw new Error("ArrayExpression is not supported");
        }
        return { type: "member_expression", identifier, property: prop };
    }
}
exports.MemberExpressionHandler = MemberExpressionHandler;
