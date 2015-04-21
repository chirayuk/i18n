/**
 * Message Types Reference
 *
 * Actual types will be in TypeScript 1.5+.  However, this TypeScript 1.4
 * version is the current official type specification.
 */

/* These fixed strings have to be stable and are intended to be
 * backwards/forwards compatible.  They are used in the computation of the
 * message fingerprint (for message id) and in the JSON serialization of our
 * messages to disk.  The actual classes that uses these typenames are free to
 * change their names or use inheritance/composition/whatever as long as they
 * eventually identify with one of these types.*/
export type StableTypeName = string;
export var /*const*/ TYPENAME_TEXT_PART:StableTypeName = "TextPart";
export var /*const*/ TYPENAME_TAG_PAIR_BEGIN_REF:StableTypeName = "TagPairBegin";
export var /*const*/ TYPENAME_TAG_PAIR_END_REF:StableTypeName = "TagPairEnd";
export var /*const*/ TYPENAME_HTML_TAG_PAIR:StableTypeName = "HtmlTagPair";
export var /*const*/ TYPENAME_NG_EXPR:StableTypeName = "NgExpr";

export type MessagePart = TextPart|Placeholder|TagPair;

export interface MessagePartBaseConstructor<T extends MessagePartBase> {
  new(...args: any[]): T;
}

var _ALL_STABLE_TYPE_NAMES = new Set<StableTypeName>();

function registerStableTypeName<T extends MessagePartBase>(part: MessagePartBaseConstructor<T>, stableTypeName: StableTypeName) {
  var ctor = <any>(part);
  if (_ALL_STABLE_TYPE_NAMES.has(stableTypeName)) {
    throw Error(`Internal Error: Attempting to reuse stable type name: ${stableTypeName}`);
  }
  _ALL_STABLE_TYPE_NAMES.add(stableTypeName);
  if (ctor.$stableTypeName !== void 0) {
    throw Error(`Internal Error: Trying to re-register stable type name for type: ${ctor}`);
  }
  ctor.$stableTypeName = stableTypeName;
}

export function getStableTypeName(part: MessagePartBase): string {
  var stableTypeName = (<any>part.constructor).$stableTypeName;
  if (stableTypeName === void 0) {
    throw Error(`Internal Error: Trying to get a stable type name for object of type: ${part.constructor}`);
  }
  return stableTypeName;
}

export interface ToLongFingerprint {
  (): string;
}

export interface MessagePartBase {
  // such as "NgExpr", "HtmlTagPair", etc.
  toLongFingerprint: ToLongFingerprint;
}

export class TextPart implements MessagePartBase {
  constructor(public value: string) { }

  // degenerate case.
  toLongFingerprint(): string { return this.value; }
}

registerStableTypeName(TextPart, TYPENAME_TEXT_PART);

export interface Placeholder extends MessagePartBase {
  name: string;
  text: string;
  examples?: string[];
  comment?: string;
}

export class PlaceholderBase implements MessagePartBase {
  constructor(public name: string, public text: string, public examples: string[], public comment: string) {}
  toLongFingerprint(): string { throw Error("You must use a subclass that overrides this method."); }
}

export class NgExpr extends PlaceholderBase {
  // TODO: toLongFingerprint must calcuate this in a proper way.
  toLongFingerprint(): string { return TYPENAME_NG_EXPR + this.text; }
}

registerStableTypeName(NgExpr, TYPENAME_NG_EXPR);

// TagPairs, when serialized, will use a pair of placeholders to represent
// their begin and end.  TagPairBeginRef and TagPairEndRef represent those placeholders.
export class TagPairRefBase implements Placeholder {
  constructor(public name: string, public text: string, public examples: string[], public comment: string) {}

  // degenerate case.
  toLongFingerprint(): string { return this.text; }
}

export class TagPairBeginRef extends TagPairRefBase {}
registerStableTypeName(TagPairBeginRef, TYPENAME_TAG_PAIR_BEGIN_REF);

export class TagPairEndRef extends TagPairRefBase {}
registerStableTypeName(TagPairEndRef, TYPENAME_TAG_PAIR_END_REF);

export class TagPair implements MessagePartBase {
  constructor(
      // tag name: e.g. "span" for the HTML <span> tag.
      public tag: string,
      // original full begin tag with all attributes, etc. as is.
      public begin: string,
      // original full end tag.
      public end: string,
      public parts: MessagePart[],
      public examples: string[],
      // canonical_key
      public tagFingerprintLong: string,
      public beginPlaceholderRef: TagPairBeginRef, // ph_begin
      public endPlaceholderRef: TagPairEndRef // ph_end
  ) {}

  // degenerate case.
  toLongFingerprint(): string { return this.tagFingerprintLong; }
}


export class HtmlTagPair extends TagPair {
  // degenerate case.
  toLongFingerprint(): string { return this.tagFingerprintLong; }

  static NewForParsing(
      tag: string,
      begin: string,
      end: string,
      parts: MessagePart[],
      examples: string[],
      tagFingerprintLong: string): HtmlTagPair {
    var beginPlaceholderRef = new TagPairBeginRef(
        /* name = */ void 0, // names are resolved much later
        /* text = */ begin,
        /* examples = */ [begin],
        /* comment = */ `Begin HTML <${tag}> tag`
        )
    var endPlaceholderRef = new TagPairEndRef(
        /* name = */ void 0, // names are resolved much later
        /* text = */ end,
        /* examples = */ [end],
        /* comment = */ `End HTML </${tag}> tag`
        )
    return new HtmlTagPair(tag, begin, end, parts, examples,
                           tagFingerprintLong, beginPlaceholderRef, endPlaceholderRef);
  }
}

registerStableTypeName(HtmlTagPair, TYPENAME_HTML_TAG_PAIR);

export interface PlaceHoldersMap {
  [placeholderName: string]: Placeholder;
}

export class Message {
  constructor(public id: string,
              public meaning: string,
              public comment: string, /* CKCK: new */
              public parts: MessagePart[],
              public placeholdersMap: PlaceHoldersMap) {}
}

// Support importing from babeljs transpiled files.
export var __esModule = true;
