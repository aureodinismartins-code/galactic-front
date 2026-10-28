/* jsdom checks for the voting record panel.
   Run: NODE_PATH=/tmp/h/node_modules node tmp-test/history-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "congress.html"), "utf8");

let failures = 0;
function check(name, cond, extra) {
    if (cond) { console.log("  ok   " + name); }
    else { failures++; console.log("  FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}

const start = HTML.indexOf("/* ---------------------------------------------------------\n   A DELEGATE'S VOTING RECORD");
const end = HTML.indexOf("function renderMember()", start);
if (start < 0 || end < 0) { throw new Error("voting record block not found"); }

const dom = new JSDOM("<!doctype html><html><body><div id=\"m-hist\"></div></body></html>", {
    url: "https://example.test/congress.html",
    runScripts: "dangerously"
});
const w = dom.window;
w.$ = id => w.document.getElementById(id);
w.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
w.T = s => s;
w.selMember = 5;
w.memberHistory = {};

w.eval(HTML.slice(start, end).replace("let memberHistory = {};", "/* memberHistory is supplied by the harness */"));

const box = w.document.getElementById("m-hist");

console.log("the voting record panel");

w.memberHistory[5] = { loading: true };
w.paintMemberHistory(5);
check("loading line while the server answers", box.textContent === "Loading the voting record...");

w.memberHistory[5] = { error: 'function public.congress_member_history does not exist' };
w.paintMemberHistory(5);
check("names the script to run when it is not installed",
    box.textContent.indexOf("sql/2026-10-27_delegate_history.sql") !== -1 &&
    box.textContent.indexOf("does not exist") !== -1);

w.memberHistory[5] = { yes: 12, no: 4, abstain: 3, bribed: 2, votes: [
    { title: "Autorizar a construção de uma nova frota", vote: "yes", bribed: true, status: "passed" },
    { title: "Proposta de aumento de impostos", vote: "no", bribed: false, status: "rejected" },
    { title: "Ajuda econômica de emergência", vote: "abstain", bribed: false, status: "passed" }
] };
w.paintMemberHistory(5);

check("summary counts", box.textContent.indexOf("YES 12 · NO 4 · ABSTAIN 3 · bribes taken: 2") === 0, box.textContent.slice(0, 60));
const rows = box.querySelectorAll(".log");
check("one row per vote", rows.length === 3, String(rows.length));
check("each row shows its vote", rows[0].textContent.trim().indexOf("YES") === 0, rows[0].textContent);
check("a bought vote is marked", rows[0].querySelector(".badge") !== null &&
    rows[0].querySelector(".badge").textContent === "BOUGHT");
check("a clean vote has no badge", rows[1].querySelector(".badge") === null);
check("rows carry the bill title", rows[1].textContent.indexOf("Proposta de aumento de impostos") !== -1);

/* a delegate who never voted */
w.memberHistory[5] = { yes: 0, no: 0, abstain: 0, bribed: 0, votes: [] };
w.paintMemberHistory(5);
check("empty record says so", box.textContent.indexOf("This delegate has not voted yet.") !== -1);

/* the panel must not paint when another delegate is selected */
w.selMember = 6;
box.innerHTML = "untouched";
w.memberHistory[5] = { yes: 1, no: 0, abstain: 0, bribed: 0, votes: [] };
w.paintMemberHistory(5);
check("a stale answer for another delegate is ignored", box.textContent === "untouched", box.textContent);

console.log(failures ? "\n" + failures + " check(s) failed" : "\nall checks passed");
process.exit(failures ? 1 : 0);
