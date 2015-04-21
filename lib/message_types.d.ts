/**
 * Message Types Reference
 *
 * Actual types will be in TypeScript 1.5+.  However, this TypeScript 1.4
 * version is the current official type specification.
 */
export declare type StableTypeName = string;
export declare var TYPENAME_TEXT_PART: StableTypeName;
export declare var TYPENAME_TAG_PAIR_BEGIN_REF: StableTypeName;
export declare var TYPENAME_TAG_PAIR_END_REF: StableTypeName;
export declare var TYPENAME_HTML_TAG_PAIR: StableTypeName;
export declare var TYPENAME_NG_EXPR: StableTypeName;
export declare type MessagePart = TextPart | Placeholder | TagPair;
export interface MessagePartBaseConstructor<T extends MessagePartBase> {
    new (...args: any[]): T;
}
export interface ToLongFingerprint {
    (): string;
}
export interface MessagePartBase {
    toLongFingerprint: ToLongFingerprint;
}
export declare class TextPart implements MessagePartBase {
    value: string;
    constructor(value: string);
    toLongFingerprint(): string;
}
export interface Placeholder extends MessagePartBase {
    name: string;
    text: string;
    examples?: string[];
    comment?: string;
}
export declare class PlaceholderBase implements MessagePartBase {
    name: string;
    text: string;
    examples: string[];
    comment: string;
    constructor(name: string, text: string, examples: string[], comment: string);
    toLongFingerprint(): string;
}
export declare class NgExpr extends PlaceholderBase {
    toLongFingerprint(): string;
}
export declare class TagPairRefBase implements Placeholder {
    name: string;
    text: string;
    examples: string[];
    comment: string;
    constructor(name: string, text: string, examples: string[], comment: string);
    toLongFingerprint(): string;
}
export declare class TagPairBeginRef extends TagPairRefBase {
}
export declare class TagPairEndRef extends TagPairRefBase {
}
export declare class TagPair implements MessagePartBase {
    tag: string;
    begin: string;
    end: string;
    parts: MessagePart[];
    examples: string[];
    tagFingerprintLong: string;
    beginPlaceholderRef: TagPairBeginRef;
    endPlaceholderRef: TagPairEndRef;
    constructor(tag: string, begin: string, end: string, parts: MessagePart[], examples: string[], tagFingerprintLong: string, beginPlaceholderRef: TagPairBeginRef, endPlaceholderRef: TagPairEndRef);
    toLongFingerprint(): string;
}
export declare class HtmlTagPair extends TagPair {
    toLongFingerprint(): string;
    static NewForParsing(tag: string, begin: string, end: string, parts: MessagePart[], examples: string[], tagFingerprintLong: string): HtmlTagPair;
}
export interface PlaceHoldersMap {
    [placeholderName: string]: Placeholder;
}
export declare class Message {
    id: string;
    meaning: string;
    comment: string;
    parts: MessagePart[];
    placeholdersMap: PlaceHoldersMap;
    constructor(id: string, meaning: string, comment: string, parts: MessagePart[], placeholdersMap: PlaceHoldersMap);
}
export declare function getStableTypeName(part: MessagePartBase): string;
export declare var __esModule: boolean;
