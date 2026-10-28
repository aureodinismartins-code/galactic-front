/* A single syntax error in a page's inline script kills every handler on it,
   and the page still looks fine — buttons simply stop doing anything. This
   checks each inline <script> the way the browser parses it.

   Run: node tmp-test/pages-syntax.js */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gf-syntax-"));

let bad = 0;
let checked = 0;

for (const page of fs.readdirSync(ROOT).filter(f => f.endsWith(".html"))) {

    const html = fs.readFileSync(path.join(ROOT, page), "utf8");
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;

    let m;
    let n = 0;

    while ((m = re.exec(html))) {

        const code = m[1];

        if (!code.trim()) { continue; }

        n++;
        checked++;

        const file = path.join(dir, page.replace(/\.html$/, "") + "-" + n + ".js");

        fs.writeFileSync(file, code);

        try {
            execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
        } catch (e) {
            bad++;
            console.log("SYNTAX ERROR in " + page + " (inline script " + n + ")");
            console.log(String(e.stderr || e.message).split("\n").slice(0, 6).join("\n"));
        }

    }

}

console.log(checked + " inline scripts checked, " + bad + " with syntax errors");

if (bad) { process.exit(1); }

console.log("ok");
