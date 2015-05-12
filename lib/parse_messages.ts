import * as assert from 'assert';
import * as util from 'util';
import * as fs from 'fs';
var S = require('string');

import * as M from './message_types';
import {adapter as treeAdapter, Node, Attr} from './parse_html';
import PlaceholderRegistry from './placeholderRegistry';
import {splitN} from './stringUtils';
import {quoteHtmlAttribute} from './quoting';
var computeIdForMessageBuilder = require('./fingerprinting').computeIdForMessageBuilder;

function nop() {}

function tobool(o: any): boolean {
  return o != null && o != "";
}

function ifNull<T>(o: T, whenNull: T): T {
  return (o == null) ? whenNull : o;
}

class ParsedComment {
  constructor(public meaning: string, public comment: string) {}
}

function validateValidPlaceholderName(phName: string) {
  if (phName == null || phName === "") {
    throw Error(`invalid placeholder name: ${phName}: empty name`);
  }
  var name = S(phName);
  if (name.startsWith("_") || name.endsWith("_")) {
    throw Error(`invalid placeholder name: ${phName}: should not begin or end with an underscore`);
  }
  name = name.replace(/_/g, '');
  if (!name.isAlphaNumeric() || name.toUpperCase().s !== name.s) {
    throw Error(`invalid placeholder name: ${phName}: It may only be composed of capital letters, digits and underscores.`);
  }
  if (name.s === 'EMBEDDED_MESSAGES') {
    throw Error(`invalid placeholder name: ${phName}: This name is reserved.`);
  }
}

function parseRawComment(rawComment: string) {
  rawComment = rawComment.trim();
  if (rawComment.indexOf("|") == -1) {
    return new ParsedComment(null, rawComment);
  }
  var [meaning, comment] = splitN(rawComment, '|', 1).map((part) => part.trim());
  if (meaning === "") {
    throw Error('meaning was explicitly specified but is empty');
  }
  return new ParsedComment(meaning, comment);
}

var NG_EXPR_PH_RE = /i18n-ph\((.*)\)/;
function parseNgExpression(text: string): M.NgExpr {
  var name: string = null, examples: string[] = null, comment = "Angular Expression";
  // text should not have the {{ }} around it.
  text = text.trim();
  if (text.lastIndexOf("//") == -1) {
    return new M.NgExpr(
        /*name=*/name, /*text=*/text, /*examples=*/examples, /*comment=*/comment);
  }
  var parts = splitN(text, '//', 1);
  text = parts[0].trim();
  var rawComment = parts[1].trim();
  var m = NG_EXPR_PH_RE.exec(rawComment);
  if (m == null || m.index != 0) {
    throw Error("Angular expression has a comment but it wasn't valid i18n-ph() syntax")
  }
  var phText = m[1].trim();
  var phName = phText, example: string = null;
  parts = splitN(phText, "|", 1);
  if (parts.length > 1) {
    phName = parts[0].trim();
    example = parts[1].trim();
  }
  validateValidPlaceholderName(phName);
  examples = (example == null) ? null : [example];
  return new M.NgExpr(
      /*name=*/phName, /*text=*/text, /*examples=*/examples, /*comment=*/comment);
}

var NG_EXPR_RE = /\{\{\s*(.*?)\s*\}\}/;
function parseMessageTextForNgExpressions(text: string, placeholderRegistry: PlaceholderRegistry) {
  var parts: M.ConcreteMessagePart[] = [];
  var splits = text.split(NG_EXPR_RE);
  if (splits.length % 2 == 1) {
    // So that our loop can "safely" inspect 2 items at a time.
    splits.push("");
  }
  for (let i = 0; i + 1 < splits.length; i += 2) {
    var txt = splits[i];
    if (txt.length > 0) {
      parts.push(new M.TextPart(txt));
    }
    var expr = splits[i+1].trim();
    if (expr.length > 0) {
      var ngExpr: M.NgExpr = placeholderRegistry.updatePlaceholder(parseNgExpression(expr));
      parts.push(ngExpr);
    }
  }
  return parts;
}

function _serializeHtmlAttr(name: string, value: string): string {
  return (value == null) ? name : `${name}=${quoteHtmlAttribute(value)}`;
}

function _getSerializedAttrs(node: Node) {
  var serializedAttrs: string[] = [];
  for (let attr of ifNull(treeAdapter.getAttrList(node), [])) {
    serializedAttrs.push(_serializeHtmlAttr(attr.name, attr.value));
  }
  return serializedAttrs.join(' ');
}

function _getHtmlBeginEndTags(node: Node): { begin: string, end: string } {
  var serializedAttrs = _getSerializedAttrs(node);
  if (serializedAttrs !== "") {
    serializedAttrs = ' ' + serializedAttrs;
  }
  var tag = treeAdapter.getTagName(node);
  var begin = `<${tag}${serializedAttrs}>`;
  var end = `</${tag}>`;
  return {begin, end};
}

function _parseNode(node: Node, placeholderRegistry: PlaceholderRegistry): M.ConcreteMessagePart[] {
  if (treeAdapter.isTextNode(node)) {
    return parseMessageTextForNgExpressions(treeAdapter.getTextNodeContent(node), placeholderRegistry);
  }
  var parts: M.ConcreteMessagePart[] = [];
  function extendParts(extra: M.ConcreteMessagePart[]) {
    extra.forEach(value => parts.push(value));
  }
  for (let child of treeAdapter.getChildNodes(node)) {
    extendParts(_parseNode(child, placeholderRegistry));
  }
  var canonicalKey = placeholderRegistry.reserveNewTag(treeAdapter.getTagName(node));
  var {begin, end} = _getHtmlBeginEndTags(node);
  var tagPair = M.HtmlTagPair.NewForParsing(
      /*tag=*/treeAdapter.getTagName(node),
      /*begin=*/begin,
      /*end=*/end,
      /*parts=*/parts,
      /*examples=*/null,
      /*tagFingerprintLong=*/canonicalKey);
  return [placeholderRegistry.updatePlaceholder(tagPair)];
}

function parseNodeContents(root: Node, placeholderRegistry: PlaceholderRegistry): M.ConcreteMessagePart[] {
  var parts: M.ConcreteMessagePart[] = [];
  function extendParts(extra: M.ConcreteMessagePart[]) {
    extra.forEach(value => parts.push(value));
  }
  ifNull(treeAdapter.getChildNodes(root), []).forEach((childNode: Node) =>
      extendParts(_parseNode(childNode, placeholderRegistry)));
  return parts;
}


export class MessageBuilder {
  public parent: MessageBuilder;
  public meaning: string;
  public comment: string;
  public parts: M.ConcreteMessagePart[];
  public placeholderRegistry: PlaceholderRegistry;

  constructor(rawComment: string, rawMessage: Node|string, parent?: MessageBuilder) {
    this.parent = parent;
    var parsedComment = parseRawComment(rawComment);
    this.meaning = parsedComment.meaning;
    this.comment = parsedComment.comment;
    this.placeholderRegistry = (parent != null ? parent.placeholderRegistry : new PlaceholderRegistry());
    if (typeof rawMessage === "string") {
      this.parts = parseMessageTextForNgExpressions(rawMessage, this.placeholderRegistry);
    } else {
      this.parts = parseNodeContents(rawMessage, this.placeholderRegistry);
    };
  }

  build(): M.Message {
    var id = computeIdForMessageBuilder(this);
    var placeholdersByName = this.placeholderRegistry.toMap();
    return new M.Message(/*id=*/id,
                         /*meaning=*/this.meaning,
                         /*comment=*/this.comment,
                         /*parts=*/this.parts,
                         /*placeholdersByName=*/placeholdersByName);
  }
}

const I18N_ATTRIB_PREFIX = 'i18n-';

export interface OnParse {
  onAttrib: (message: M.Message, node: Node, attrName: string) => void;
  onNode:   (message: M.Message, node: Node) => void;
}

const _dummyOnParse: OnParse = {
  onAttrib: nop,
  onNode: nop
};


function _findAttrib(node: Node, attrName: string): Attr {
  for (let attr of ifNull(treeAdapter.getAttrList(node), [])) {
    if (attr.name === attrName) {
      return attr;
    }
  }
  return null;
}

export type MessagesMap = Map<string, M.Message>;

class MessageParser {
  public nodes: Node[] = [];
  public messages: MessagesMap = new Map<string, M.Message>();

  constructor(public onParse: OnParse) {}

  _parseI18nAttribs(node: Node): void {
    var attrList: Attr[] = treeAdapter.getAttrList(node);
    if (attrList == null || attrList.length == 0) {
      return;
    }
    var i18nAttribs: Attr[] = [];
    var valuesByName = new Map();
    attrList.forEach(function(attr) {
      valuesByName.set(attr.name, attr.value);
      if (attr.name.indexOf(I18N_ATTRIB_PREFIX) == 0) {
        i18nAttribs.push(attr);
      }
    });
    if (i18nAttribs.length == 0) {
      return;
    }
    for (let i18nAttr of i18nAttribs) {
      let attrName = i18nAttr.name.substr(I18N_ATTRIB_PREFIX.length);
      let rawMessage = valuesByName.get(attrName);
      let message = new MessageBuilder(/*rawComment=*/i18nAttr.value, /*rawMessage*/rawMessage).build();
      this.messages.set(message.id, message);
      this.onParse.onAttrib(message, node, attrName);
    }
  }

  // Returns true if this was an i18n node and false otherwise.
  _parseMessagesInI18nNode(node: Node): boolean {
    var i18nAttr = _findAttrib(node, "i18n");
    if (i18nAttr == null) {
      return false;
    }
    let message = new MessageBuilder(/*rawComment=*/i18nAttr.value, /*rawMessage*/node).build();
    this.messages.set(message.id, message);
    this.onParse.onNode(message, node);
    return true;
  }

  parseMessages(root: Node): void {
    this.nodes.push(root);
    while (this.nodes.length > 0) {
      let node = this.nodes.shift();
      this._parseI18nAttribs(node);
      if (!this._parseMessagesInI18nNode(node)) {
        // Not an i18n node so we should descend into it.
        var childNodes = treeAdapter.getChildNodes(node);
        if (tobool(childNodes)) {
          this.nodes.unshift.apply(this.nodes, childNodes);
        }
      }
    }
  }
}


export function parseMessages(rootNode: Node, onParse?: OnParse): MessagesMap {
  if (onParse == null) {
    onParse = _dummyOnParse;
  }
  var parser = new MessageParser(onParse);
  parser.parseMessages(rootNode);
  return parser.messages;
}
