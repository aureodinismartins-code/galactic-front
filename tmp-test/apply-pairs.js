/* apply exact old -> new text pairs to a file; every pair must match once */
const fs = require('fs');
const file = process.argv[2];
const pairs = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
let s = fs.readFileSync(file, 'utf8');
let bad = 0;
for (const [a, b] of pairs) {
    const n = s.split(a).length - 1;
    console.log((n === 1 ? '  ok   ' : (n === 0 ? '  gone ' : '  FAIL ' + n)) + '  ' + a.replace(/\s+/g, ' ').slice(0, 72));
    if (n === 1) { s = s.split(a).join(b); } else if (n > 1) { bad++; }
}
fs.writeFileSync(file, s);
console.log('wrote ' + file + (bad ? '  (' + bad + ' ambiguous pair(s))' : ''));
process.exit(bad ? 1 : 0);
