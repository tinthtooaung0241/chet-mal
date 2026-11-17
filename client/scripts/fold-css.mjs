// Fold stacked CSS overrides without changing what the page computes:
//  1. drop a declaration when a later rule with the same selector, in the same @media context,
//     sets the same property (it could never win);
//  2. move what's left of an earlier block into the later block of the same selector, when no
//     rule in between could change the outcome (same specificity + same property family).
// Run: node client/scripts/fold-css.mjs <path to the postcss package> client/src/style.css
// (postcss comes with Vite: node_modules/.pnpm/postcss@*/node_modules/postcss). Run it until
// it reports nothing merged, then check the screens: it is built to be safe, not proven.
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const postcss = require(process.argv[2]);
const file = process.argv[3];
const root = postcss.parse(fs.readFileSync(file, "utf8"));

const ctxOf = (node) => {
  const chain = [];
  for (let p = node.parent; p && p.type !== "root"; p = p.parent) chain.unshift(p.type === "atrule" ? `@${p.name} ${p.params.replace(/\s+/g, " ")}` : "?");
  return chain.join(" >> ");
};
const skipCtx = (ctx) => /@keyframes|@font-face|\?/.test(ctx);
const RISKY = /dvh|svh|lvh|dvw|env\(|-webkit-|-moz-|image-set|color-mix|@supports/;

// --- specificity ---
function splitTop(s, sep) {
  const out = []; let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === sep && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur); return out;
}
function spec(sel) {
  let a = 0, b = 0, c = 0, i = 0;
  const s = sel.trim();
  while (i < s.length) {
    const ch = s[i];
    if (ch === "#") { a++; i++; while (i < s.length && /[\w-]/.test(s[i])) i++; }
    else if (ch === ".") { b++; i++; while (i < s.length && /[\w-]/.test(s[i])) i++; }
    else if (ch === "[") { b++; let d = 0; do { if (s[i] === "[") d++; if (s[i] === "]") d--; i++; } while (d > 0 && i < s.length); }
    else if (ch === ":") {
      const pe = s[i + 1] === ":"; i += pe ? 2 : 1;
      let name = ""; while (i < s.length && /[\w-]/.test(s[i])) name += s[i++];
      let arg = null;
      if (s[i] === "(") { let d = 0, st = i + 1; do { if (s[i] === "(") d++; if (s[i] === ")") d--; i++; } while (d > 0 && i < s.length); arg = s.slice(st, i - 1); }
      if (pe || /^(before|after|first-line|first-letter)$/.test(name)) c++;
      else if (name === "where") { /* nothing */ }
      else if (/^(is|not|has|matches)$/.test(name) && arg != null) {
        const best = splitTop(arg, ",").map(spec).sort((x, y) => y[0] - x[0] || y[1] - x[1] || y[2] - x[2])[0];
        a += best[0]; b += best[1]; c += best[2];
      } else if (/^(nth-child|nth-last-child)$/.test(name) && arg && / of /.test(arg)) { b++; const best = splitTop(arg.split(/ of /)[1], ",").map(spec).sort((x, y) => y[0] - x[0] || y[1] - x[1] || y[2] - x[2])[0]; a += best[0]; b += best[1]; c += best[2]; }
      else b++;
    }
    else if (/[a-zA-Z]/.test(ch)) { c++; while (i < s.length && /[\w-]/.test(s[i])) i++; }
    else i++;
  }
  return [a, b, c];
}
const FAMILIES = ["margin", "padding", "border", "font", "background", "flex", "grid", "gap", "inset", "overflow", "transition", "animation", "outline", "text-decoration", "place", "align", "justify", "list-style", "column", "row", "mask", "scroll", "overscroll", "white-space", "text-wrap", "container", "translate", "transform"];
const family = (prop) => {
  if (prop.startsWith("--")) return prop;
  if (/^(top|right|bottom|left)$/.test(prop)) return "inset";
  if (/^(row-gap|column-gap)$/.test(prop)) return "gap";
  if (/^(grid|flex|place|align|justify)/.test(prop)) return "layout"; // flex/grid/place/align shorthands overlap
  if (/^(min-|max-)?(width|height)$/.test(prop) || /^(inline|block)-size$/.test(prop)) return prop;
  if (/^border.*radius$/.test(prop)) return "border-radius";
  return FAMILIES.find((f) => prop === f || prop.startsWith(f + "-")) ?? prop;
};

// --- collect rules in document order ---
const rules = [];
root.walkRules((rule) => {
  const ctx = ctxOf(rule);
  if (skipCtx(ctx)) return;
  rules.push({ rule, ctx, sels: rule.selectors.map((s) => s.replace(/\s+/g, " ").trim()), specs: rule.selectors.map((s) => spec(s).join(",")) });
});
rules.forEach((r, i) => (r.i = i));

// 1. dead declarations
let dead = 0;
const laterBySel = new Map(); // ctx|sel -> [rule indexes]
for (const r of rules) for (const s of r.sels) { const k = r.ctx + "||" + s; (laterBySel.get(k) ?? laterBySel.set(k, []).get(k)).push(r.i); }
for (const r of rules) {
  r.rule.each((d) => {
    if (d.type !== "decl") return;
    if (RISKY.test(d.value)) return;
    const killed = r.sels.every((s) =>
      laterBySel.get(r.ctx + "||" + s).some((j) => j > r.i && rules[j].rule.some((e) => e.type === "decl" && e.prop === d.prop && (e.important || !d.important) && !RISKY.test(e.value))),
    );
    if (killed) { d.remove(); dead++; }
  });
}

// 2. merge an earlier block into the later one with the same selector list and context
let merged = 0; const why = { noparent: 0, empty: 0, unsafe: 0, groups: 0 };
const declsOf = (r) => r.rule.nodes.filter((n) => n.type === "decl");
const byKey = new Map();
for (const r of rules) { const k = r.ctx + "||" + r.sels.join(", "); (byKey.get(k) ?? byKey.set(k, []).get(k)).push(r); }
const hasAll = rules.some((r) => declsOf(r).some((d) => d.prop === "all"));
for (const group of byKey.values()) {
  if (group.length > 1) why.groups++;
  for (let g = 0; g + 1 < group.length; g++) {
    const a = group[g], b = group[g + 1];
    if (!a.rule.parent) { why.noparent++; continue; }
    if (declsOf(a).some((d) => d.prop === "all") || declsOf(b).some((d) => d.prop === "all")) continue;
    const mine = declsOf(a);
    if (!mine.length) { why.empty++; continue; }
    if (a.rule.nodes.some((n) => n.type !== "decl" && n.type !== "comment")) continue;
    const fams = new Set(mine.map((d) => family(d.prop)));
    const specs = new Set(a.specs);
    let safe = true;
    for (let j = a.i + 1; j < b.i && safe; j++) {
      const m = rules[j];
      if (!m.rule.parent) continue;
      if (!m.specs.some((s) => specs.has(s))) continue;
      if (declsOf(m).some((d) => d.prop === "all" || fams.has(family(d.prop)))) safe = false;
    }
    // the later block's own declarations must still come after the moved ones
    if (!safe) { why.unsafe++; continue; }
    if (mine.some((d) => d.important) || declsOf(b).some((d) => d.important)) { /* order inside one block is preserved, fine */ }
    const comments = a.rule.nodes.filter((n) => n.type === "comment");
    for (const n of [...mine].reverse()) b.rule.prepend(n.clone());
    void comments;
    a.rule.removeAll();
    merged++;
  }
}

// 3. sweep empty rules and at-rules (keep comments that sat directly before a removed rule out of it)
let emptied = 0;
root.walkRules((rule) => { if (!rule.nodes.some((n) => n.type === "decl" || n.type === "rule" || n.type === "atrule")) { rule.remove(); emptied++; } });
let again = true;
while (again) { again = false; root.walkAtRules((at) => { if (at.nodes && !at.nodes.some((n) => n.type !== "comment")) { at.remove(); again = true; } }); }

fs.writeFileSync(file, root.toString());
console.log(JSON.stringify({ rules: rules.length, dead, merged, emptied, why, hasAll }));
