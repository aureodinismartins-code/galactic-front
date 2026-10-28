/* static audit: which visible text on each page is still English in Portuguese?
   Only the markup's own text is checked (what the scripts draw later is not
   present without a server), which is enough to catch leftover labels. */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const I18N = fs.readFileSync('i18n.js', 'utf8');
const ENGLISH = /\b(the|of|and|your|with|from|this|that|are|is|to|on|by|not|no|players|selected|under|cities|battle|attack|fleet|credits|planet|faction|target|nation|world|worlds|army|enemy|press|click|left|right)\b/i;

const pages = fs.readdirSync('.').filter(f => f.endsWith('.html'));

for (const file of pages) {

    const html = fs.readFileSync(file, 'utf8');
    const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/gi, ''), { url: 'https://e.test/', runScripts: 'dangerously' });
    const w = dom.window;
    w.localStorage.setItem('gf_lang', 'pt');
    Object.defineProperty(w.document, 'readyState', { value: 'complete', configurable: true });
    w.eval(I18N);

    const out = [];
    const walker = w.document.createTreeWalker(w.document.body, 4 /* SHOW_TEXT */);
    let n;
    while ((n = walker.nextNode())) {
        const t = n.nodeValue.replace(/\s+/g, ' ').trim();
        if (!t || t.length < 4) { continue; }
        if (!/[A-Za-z]{2}/.test(t)) { continue; }
        /* a leftover is a text that still reads as English after translation */
        if (ENGLISH.test(t)) { out.push(t); }
    }

    if (out.length) {
        console.log('\n=== ' + file + ' ===');
        for (const t of [...new Set(out)]) { console.log('  ' + t); }
    }

}
