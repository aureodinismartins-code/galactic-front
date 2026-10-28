/* Which static text in the pages has no Portuguese translation?
   Run: NODE_PATH=/tmp/h/node_modules node tmp-test/audit.js */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const I18N = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");
const PAGES = ["index.html", "galaxy.html", "planet.html", "battle.html", "congress.html", "space.html"];

const ATTRS = ["placeholder", "title", "alt", "aria-label"];

for (const page of PAGES) {

    const html = fs.readFileSync(path.join(ROOT, page), "utf8")
        .replace(/<script[\s\S]*?<\/script>/gi, "");

    const dom = new JSDOM(html, { url: "https://example.test/" + page, runScripts: "outside-only" });
    const { window } = dom;
    window.localStorage.setItem("gf_lang", "pt");
    window.eval(I18N);

    const missing = [];
    const walker = window.document.createTreeWalker(window.document.body, 4 /* SHOW_TEXT */);
    let n;
    while ((n = walker.nextNode())) {
        const raw = String(n.nodeValue || "").replace(/\s+/g, " ").trim();
        if (!raw || raw.length < 2) { continue; }
        if (!/[A-Za-z]{3}/.test(raw)) { continue; }
        if (window.t(raw) === raw) { missing.push(raw); }
    }

    window.document.querySelectorAll("*").forEach(el => {
        ATTRS.forEach(a => {
            if (!el.hasAttribute(a)) { return; }
            const v = el.getAttribute(a);
            if (!v || !/[A-Za-z]{3}/.test(v)) { return; }
            if (window.t(v) === v) { missing.push("[" + a + "] " + v); }
        });
    });

    const uniq = Array.from(new Set(missing));
    console.log("\n=== " + page + " — " + uniq.length + " untranslated");
    uniq.slice(0, 40).forEach(s => console.log("  " + s));
}
