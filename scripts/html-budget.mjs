import { StringDecoder } from 'node:string_decoder';

// Archive snapshots expand inline styling. Admit them with separate wire, DOM,
// text and element budgets; remove only non-rendered scripts and HTML comments.
// CSS and all element attributes stay intact for visibility and gate checks.
export const HTML_LIMITS = Object.freeze({ maxBytes: 12_000_000, maxInputBytes: 24_000_000, maxTextBytes: 1_000_000, maxElements: 50_000, maxTokenBytes: 256_000 });
export class HtmlBudgetFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}
export async function collectHtml(chunks, options = {}) {
  const limits = { ...HTML_LIMITS, ...options };
  const decoder = new StringDecoder('utf8');
  const output = [];
  let pending = '', mode = 'html', rawName = '', scriptHasBody = false, bytes = 0, inputBytes = 0, textBytes = 0, elements = 0, removedBytes = 0;
  const add = (value, prose = false) => {
    const size = Buffer.byteLength(value);
    bytes += size;
    if (prose) textBytes += size;
    if (bytes > limits.maxBytes || textBytes > limits.maxTextBytes) throw new HtmlBudgetFailure('response_too_large');
    if (value) output.push(value);
  };
  const drop = value => { removedBytes += Buffer.byteLength(value); };
  const scriptBody = value => {
    // Keep the script element, its attributes, and empty/nonempty state so CSS
    // such as script[data-x] + p or script:not(:empty) + p still hides content.
    if (value && !scriptHasBody) { add(' '); removedBytes--; scriptHasBody = true; }
    drop(value);
  };
  function consume(final = false) {
    while (pending) {
      if (mode === 'comment') {
        const end = pending.indexOf('-->');
        if (end < 0) { const n = final ? pending.length : Math.max(0, pending.length - 2); drop(pending.slice(0, n)); pending = pending.slice(n); return; }
        drop(pending.slice(0, end + 3)); pending = pending.slice(end + 3); mode = 'html'; continue;
      }
      if (mode === 'raw') {
        const match = new RegExp(`</${rawName}(?=[\\t\\n\\f\\r />])`, 'i').exec(pending);
        if (!match) {
          const n = final ? pending.length : Math.max(0, pending.length - rawName.length - 4);
          if (rawName === 'script') scriptBody(pending.slice(0, n)); else add(pending.slice(0, n), !['style','iframe','noembed','noframes'].includes(rawName));
          pending = pending.slice(n); return;
        }
        if (rawName === 'script') scriptBody(pending.slice(0, match.index)); else add(pending.slice(0, match.index), rawName !== 'style');
        pending = pending.slice(match.index); mode = 'html';
      }
      const start = pending.indexOf('<');
      if (start < 0) { add(pending, true); pending = ''; return; }
      if (start > 0) { add(pending.slice(0, start), true); pending = pending.slice(start); }
      if (pending.startsWith('<!--')) { mode = 'comment'; continue; }
      if (!final && pending.length < 4) return;
      // A less-than sign in ordinary prose is not necessarily an HTML tag.
      if (!/^<(?:[a-zA-Z!/?])/.test(pending)) { add('<', true); pending = pending.slice(1); continue; }
      let quote = '', end = -1;
      for (let i = 1; i < pending.length; i++) {
        const char = pending[i];
        if (quote) { if (char === quote) quote = ''; }
        else if (char === '"' || char === "'") quote = char;
        else if (char === '>') { end = i; break; }
      }
      if (end < 0) {
        if (Buffer.byteLength(pending) > limits.maxTokenBytes) throw new HtmlBudgetFailure('response_too_large');
        if (final) { add(pending); pending = ''; }
        return;
      }
      const tag = pending.slice(0, end + 1);
      if (Buffer.byteLength(tag) > limits.maxTokenBytes) throw new HtmlBudgetFailure('response_too_large');
      pending = pending.slice(end + 1);
      const name = /^<\s*([a-zA-Z][\w:-]*)\b/.exec(tag)?.[1].toLowerCase();
      if (name && ++elements > limits.maxElements) throw new HtmlBudgetFailure('too_many_elements');
      add(tag);
      if (name && ['script','style','textarea','title','xmp','iframe','noembed','noframes'].includes(name)) { mode = 'raw'; rawName = name; scriptHasBody = false; }
    }
  }
  for await (const chunk of chunks) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    inputBytes += buffer.length;
    if (inputBytes > limits.maxInputBytes) throw new HtmlBudgetFailure('response_too_large');
    pending += decoder.write(buffer);
    consume();
  }
  pending += decoder.end(); consume(true);
  return { body: output.join(''), processing: { input_bytes: inputBytes, html_bytes: bytes, removed_noncontent_bytes: removedBytes, element_count: elements } };
}
