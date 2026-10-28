/* renders each Congress tab in Portuguese and prints the text, so any English
   left in the page is visible */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync('congress.html', 'utf8');
const I18N = fs.readFileSync('i18n.js', 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://e.test/', runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
w.localStorage.setItem('gf_lang', 'pt');
const errors = [];
w.addEventListener('error', e => errors.push(String(e.message)));
w.alert = () => {};
w.eval(I18N);

w.$ = id => w.document.getElementById(id);
w.supabaseClient = { rpc: () => Promise.resolve({ data: null, error: null }) };

const now = new Date();
const iso = s => new Date(now.getTime() + s * 1000).toISOString();

const ov = {
    now: now.toISOString(), credits: 4820, seats: 176, majority: 88, supermajority: 118,
    factions: [
        { id: 1, key: 'old_guard', name: 'The Old Guard', color: '#c8a24a', seats: 40, loyalty: 62, priorities: ['military_action'], description: 'Tradicional e militarista' },
        { id: 2, key: 'greens', name: 'The Greens', color: '#3fa64a', seats: 36, loyalty: 58, priorities: ['diplomacy'], description: 'Foco ambiental' },
        { id: 3, key: 'progressives', name: 'Progressives', color: '#c85a4a', seats: 50, loyalty: 66, priorities: ['fleet_construction'], description: 'Reformas progressistas' },
        { id: 4, key: 'independents', name: 'Independents', color: '#8a8a8a', seats: 50, loyalty: 40, priorities: [], description: 'Sem alinhamento' }
    ],
    members: [
        { id: 10, name: 'Ana Rocha', faction: 1, region: 'Core', area: 1, seat: 1, loyalty: 70, planet: null, suspect: false },
        { id: 11, name: 'Beto Lima', faction: 2, region: 'Rim', area: 2, seat: 2, loyalty: 55, planet: 'Veyrona', suspect: true }
    ],
    proposals: [
        {
            id: 7, title: 'Autorizar a construção de uma nova frota', type: 'fleet_construction', sponsor: 3,
            status: 'debate', debate_at: iso(-60), vote_at: iso(240), mine: true, by_president: false,
            proposer: '111Augimang', yes: 0, no: 0, abstain: 0, required: 118,
            bribes: [{ member: 10, amount: 500, stance: 'yes' }],
            forecast: [{ faction: 1, p: 51 }, { faction: 2, p: 29 }, { faction: 3, p: 79 }, { faction: 4, p: 74 }],
            result: null
        },
        {
            id: 8, title: 'Declaração de Guerra contra Veyrona', type: 'military_action', sponsor: 1,
            status: 'passed', mine: false, by_president: true, proposer: 'Ana', yes: 120, no: 40, abstain: 16,
            required: 88, bribes: [], forecast: [],
            result: { effect: 'O Congresso declarou guerra contra Veyrona: as frotas da Freedom Authority podem atacá-lo.', defections: ['Beto Lima'], removed: ['Ana Rocha'] }
        }
    ],
    targets: [{ planet: 'Veyrona', owners: 'Independents', declared: false }],
    my_fleets: [{ id: 'f1', name: 'Lance' }],
    planets: [{ name: 'Veyrona', x: 30, y: 40, owner: 'Independents' }],
    occupations: [{ planet: 'Veyrona', stage: 1, stage_name: 'administração civil', seats: 12, seats_target: 20, stability: 64, threshold: 70, progress: 2, duration: 6 }],
    authorizations: { fleet: 1, knightmare: 0, war: ['Krieg'] },
    state: { popularity: 61, tax_level: 1, relations: { Combine: -10, Independents: 20 } },
    president: { name: 'Ana Rocha', faction: 1, term_no: 2, term_end: iso(300), veto_used: false, me: true },
    election: { phase: 'campaign', campaign_end: iso(200), vote_end: iso(400), candidates: [{ player_id: 'p1', name: 'Ana Rocha', faction: 1, mine: true }], voters: 4, voted: 1, my_vote: null },
    my_party: 1,
    parties: [{ faction: 1, players: ['Ana Rocha'] }],
    last_election: { winner: 'Ana Rocha', result: { note: 'Venceu por 3 a 1.' } },
    log: [{ at: now.toISOString(), text: 'PROPOSTA: Progressives leva "Autorizar a construção de uma nova frota" ao Congresso.' }]
};

w.ov = ov;
w.draft = { type: 'fleet_construction', planet: '', fleet: 'f1', target: 'Combine', sponsor: 'old_guard' };
w.warTarget = 'Veyrona';
w.debate = {
    proposals: [{
        id: 7, yes: 84, no: 61, undecided: 31,
        sides: { '10': 'yes', '11': 'no' },
        factions: { '1': { yes: 20, no: 18, undecided: 2 }, '2': { yes: 10, no: 24, undecided: 2 }, '3': { yes: 44, no: 6, undecided: 0 }, '4': { yes: 10, no: 13, undecided: 27 } }
    }]
};
w.propState = { credits: 4820, cooldown: 600, fleets: 2, factions: { '1': { runs: 2, spent: 3500, last_at: iso(-120) } } };
w.propError = null;
w.unrest = {
    turn: 300, revolt_at: 100,
    worlds: [{ planet: 'Veyrona', faction: 'Freedom Authority', unrest: 62, mood: 'RIOTING', revolts: 1, mine: true }]
};
w.speaker = {
    mine: true,
    speaker: { name: 'Bia Costa', party: 'Progressives', term_no: 1, term_end: iso(600), veto_used: false, me: false },
    election: {
        phase: 'voting', campaign_end: iso(-60), vote_end: iso(300),
        candidates: [{ player_id: 'p2', name: 'Bia Costa', party: 'Progressives', mine: false, votes: 2 }],
        my_vote: null, voted: 2
    },
    last: null
};
w.dip = {
    now: now.toISOString(), me: 'Freedom Authority', other: 'Combine', credits: 4820, cost: 500, wait: 300,
    relations: { authority: 60, combine: 20, need: 50, dividend: 10, truce: false },
    planets: [{ planet: 'Veyrona', relation: 40, envoys: 4, wait: 120, theirs: 10 }]
};
w.dipError = null;

const slice = (a, b) => HTML.slice(HTML.indexOf(a), HTML.indexOf(b, HTML.indexOf(a)));
w.eval([
    'var selProposal = 7, selMember = 10, regionFilter = null, factionFilter = null, groupBy = "faction";',
    'var esc = function (s) { return String(s == null ? "" : s); };',
    'var fmt = function (n) { return Number(n || 0).toLocaleString(); };',
    'var mmss = function (s) { return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };',
    'var secondsLeft = function (ts) { return Math.max(0, Math.round((new Date(ts).getTime() - Date.now() + 0) / 1000)); };',
    'var T = function (s) { return typeof window.t === "function" ? window.t(s) : s; };',
    'var toast = function () {};',
    slice('const TYPES', 'let ov = null;'),
    slice('function factionById', 'function render()'),
    slice('function liveDebateFor', 'function renderLegend()'),
    slice('/* ---- proposals ---- */', '/* ---- the Congress Leader'),
    slice('/* ---- the Congress Leader: the player the players elected ---- */', '/* ---- mini map of the galaxy'),
    slice('/* ---- mini map of the galaxy', '/* ---- new proposal ---- */'),
    slice('/* ---- new proposal ---- */', '/* ---- propaganda ---- */'),
    slice('/* ---- propaganda ---- */', '/* ---- occupied worlds ---- */'),
    slice('/* ---- occupied worlds ---- */', '/* ---- authority ---- */'),
    slice('/* ---- authority ---- */', 'function wireAuthority()')
].join('\n'));

const strip = s => s.replace(/\s+/g, ' ').trim();

(async () => {

    const box = w.document.createElement('div');
    w.document.body.appendChild(box);
    if (errors.length) { console.log('SCRIPT ERRORS:', errors); }

    const tabs = [['PROPOSALS', 'proposalsHtml'], ['LEADER', 'leaderHtml'], ['PARTY', 'partyHtml'],
                  ['NEW', 'newHtml'],
                  ['PROPAGANDA', 'propagandaHtml'], ['OCCUPIED', 'occupiedHtml'], ['AUTHORITY', 'authorityHtml']];

    for (const [name, fn] of tabs) {
        box.innerHTML = w[fn]();
        await new Promise(r => setTimeout(r, 40));
        console.log('\n===== ' + name + ' =====\n' + strip(box.textContent));
    }

    box.innerHTML = ov.log.map(l => '<div class="log"><time>12:00</time>' + w.esc(l.text) + '</div>').join('');
    await new Promise(r => setTimeout(r, 40));
    console.log('\n===== NEWS =====\n' + strip(box.textContent));

})();
