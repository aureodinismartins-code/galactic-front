/* =========================================================
   GALACTIC FRONT — THE FRONT PAGE
   One newspaper for the whole war, and one pen.

   THE EDITOR is the HOST — the account in game_control.host_player, the one
   holding the reset, the maintenance keys and the wireless. The editor
   writes a story and it is on the front page at once; edits anything
   already printed, sets the lead story, takes a story off the page, or
   burns it.

   THE TWO FACTION LEADERS — the President of the Freedom Authority and the
   High Commissar of the Combine, the offices the players elect — may FILE A
   DISPATCH. It waits in the editor's tray, and nothing a commander writes
   reaches the front page without the editor's yes. A refusal carries the
   editor's note back to the desk that filed it.

   PICTURES travel as links the author pastes, or as uploads into the public
   "news" bucket when the project has storage. A picture that cannot travel
   is shown on the author's own screen for as long as the page is open.

   Everybody else reads. The paper lives in the database
   (sql/2026-11-11_the_front_page.sql), so every screen reads the same
   edition.

   No dependencies: this file is included by every screen.
========================================================= */

(function() {

    "use strict";

    const POLL_MS = 30000;
    const PATCH = "sql/2026-11-11_the_front_page.sql";

    const BTN = "background:#0e2233;color:#bfe4ff;border:1px solid #2f6280;padding:4px 8px;" +
                "font:11px Arial;cursor:pointer;";
    const FIELD = "width:100%;box-sizing:border-box;padding:6px;background:#0b1622;border:1px solid #2b4b61;" +
                  "color:#dff1ff;margin-bottom:6px;font:12px Arial;";

    let state = null;        /* the edition the server last handed over */
    let live = false;        /* the presses have answered */
    let missing = false;     /* the SQL of the front page has not been run */
    let panel = null;        /* the overlay */
    let panelBody = null;
    let button = null;
    let views = [];          /* every container the paper is drawn into */
    let tab = "page";        /* page | desk | file */
    let editing = null;      /* the story the editor is rewriting */
    let draft = null;        /* what is in the composer right now */
    let localPicture = null; /* a file from this computer: this screen only */
    let unfolded = {};       /* stories whose full text is shown */
    let timer = null;
    let tries = 0;

    /* ---------- small helpers ---------- */

    function T(text) {
        try { return (typeof window.T === "function") ? window.T(text) : text; }
        catch (e) { return text; }
    }

    function esc(text) {
        return String(text === undefined || text === null ? "" : text)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    /* a story keeps its line breaks */
    function para(text) {
        return esc(text).replace(/\r?\n/g, "<br>");
    }

    function client() {
        try {
            if (typeof supabaseClient !== "undefined" && supabaseClient &&
                typeof supabaseClient.rpc === "function") {
                return supabaseClient;
            }
        }
        catch (e) { /* the page has no client before its script loads */ }

        const other = window.supabaseClient;
        return (other && typeof other.rpc === "function") ? other : null;
    }

    function call(name, args) {
        const c = client();
        if (!c) { return Promise.resolve({ data: null, error: null }); }
        try {
            return Promise.resolve(c.rpc(name, args)).then(
                function(res) { return res || { data: null, error: null }; },
                function(err) { return { data: null, error: err }; });
        }
        catch (e) { return Promise.resolve({ data: null, error: e }); }
    }

    function reason(err) {
        return String((err && err.message) ? err.message : (err || ""));
    }

    function when(ts) {
        if (!ts) { return ""; }
        try { return new Date(ts).toLocaleString(); }
        catch (e) { return ""; }
    }

    function statusWord(status) {
        if (status === "published") { return T("PRINTED"); }
        if (status === "refused") { return T("TURNED DOWN"); }
        if (status === "draft") { return T("IN THE DRAWER"); }
        return T("WAITING FOR THE EDITOR");
    }

    /* ---------- the server ---------- */

    function apply(answer) {

        if (!answer) { return; }

        live = true;
        missing = false;
        state = answer;

        paint();

    }

    function refresh() {
        return call("news_state").then(function(res) {
            if (res.error) {
                if (/schema cache|does not exist/i.test(reason(res.error))) { missing = true; paint(); }
                return;
            }
            apply(res.data);
        });
    }

    function act(name, args) {
        return call(name, args).then(function(res) {
            if (res.error) { paint(); say(reason(res.error)); return null; }
            apply(res.data);
            return res.data;
        });
    }

    function say(text) {
        views.forEach(function(view) {
            const box = view.el && view.el.querySelector(".gf-news-note");
            if (box) { box.textContent = text; }
        });
    }

    /* ---------- the composer ---------- */

    function blank() {
        return { headline: "", standfirst: "", body: "", image: "", caption: "" };
    }

    function beginStory(story) {

        editing = (story && story.id) || null;
        draft = story ? {
            headline: story.headline || "",
            standfirst: story.standfirst || "",
            body: story.body || "",
            image: story.image || "",
            caption: story.caption || ""
        } : blank();

        localPicture = null;

        /* the composer is the first thing on the desk */
        views.forEach(function(view) { if (view.el) { view.el.scrollTop = 0; } });

        paint();

    }

    function readComposer(target) {

        const box = target.querySelector(".gf-news-compose");
        if (!box || !draft) { return; }

        draft.headline = box.querySelector('[data-gf="headline"]').value;
        draft.standfirst = box.querySelector('[data-gf="standfirst"]').value;
        draft.body = box.querySelector('[data-gf="body"]').value;
        draft.image = box.querySelector('[data-gf="image"]').value;
        draft.caption = box.querySelector('[data-gf="caption"]').value;

    }

    function sendStory(editor) {

        if (!draft) { draft = blank(); }
        if (!String(draft.headline || "").trim()) { say(T("A story needs a headline")); return; }

        const args = {
            p_headline: draft.headline,
            p_standfirst: draft.standfirst,
            p_body: draft.body,
            p_image_url: draft.image ? draft.image : null,
            p_image_caption: draft.caption ? draft.caption : null
        };

        say(T(editor ? "Publishing..." : "Filing..."));

        if (editor) {
            args.p_id = editing;
            act("news_write", args).then(function(done) {
                if (done) { editing = null; draft = blank(); localPicture = null; }
            });
        }
        else {
            act("news_file", args).then(function(done) {
                if (done) { draft = blank(); localPicture = null; }
            });
        }

    }

    /*
       A picture picked from this computer travels only if the project has
       storage: it goes into the public "news" bucket and comes back as a
       link everybody can see. Without storage, or when the upload is
       refused, the picture stays on this screen and the paper says what
       to do instead.
    */
    function pickPicture(file) {

        if (!file) { return; }

        let mine = null;
        try { mine = URL.createObjectURL(file); } catch (e) { mine = null; }
        localPicture = mine ? { url: mine, name: String(file.name || "picture") } : null;

        const c = client();
        const storage = c && c.storage;

        if (!storage || typeof storage.from !== "function") {
            paint();
            say(T("This project has no picture storage: put the picture online and paste its link."));
            return;
        }

        const ext = (String(file.name || "").split(".").pop() || "png").toLowerCase()
            .replace(/[^a-z0-9]/g, "").slice(0, 5) || "png";
        const who = (state && state.is_editor) ? "editor" : "leader";
        const path = who + "/" + Date.now().toString(36) + "-" +
            Math.random().toString(36).slice(2, 8) + "." + ext;

        say(T("Sending the picture..."));

        let done;
        try {
            done = storage.from("news").upload(path, file, {
                upsert: false, cacheControl: "31536000", contentType: file.type || undefined
            });
        }
        catch (e) { done = Promise.reject(e); }

        Promise.resolve(done).then(function(res) {

            if (res && res.error) { throw new Error(reason(res.error)); }

            const pub = storage.from("news").getPublicUrl(path);
            const url = pub && pub.data && pub.data.publicUrl;
            if (!url) { throw new Error("the upload gave back no link"); }

            if (!draft) { draft = blank(); }
            draft.image = url;

            const box = document.querySelector(".gf-news-compose");
            if (box && box.querySelector('[data-gf="image"]')) {
                box.querySelector('[data-gf="image"]').value = url;
            }

            paint();
            say(T("The picture is up. It will show on every screen."));

        }).catch(function(err) {
            paint();
            say(T("The picture could not be uploaded: put it online and paste its link.") +
                " (" + reason(err) + ")");
        });

    }

    /* ---------- what the paper looks like ---------- */

    function masthead() {

        const stories = state && Array.isArray(state.published) ? state.published.length : 0;
        const editor = state && state.is_editor;
        const leader = state && state.leader;

        let who = "";
        if (editor) { who = T("the editor holds the pen"); }
        else if (leader) { who = T("your desk files dispatches"); }
        else { who = T("the front page of the war"); }

        return '<div style="text-align:center;border-bottom:3px double #3f7f9f;padding-bottom:8px;margin-bottom:8px">' +
            '<div style="font-size:23px;font-weight:900;letter-spacing:6px;color:#eaf6ff">' +
                esc(T("THE GALACTIC FRONT")) + '</div>' +
            '<div style="color:#7fa8c0;font-size:11px;letter-spacing:3px;margin-top:4px">' +
                esc(T("THE FRONT PAGE")) + ' &middot; ' + esc(when(state && state.now).split(",")[0] || "") +
                ' &middot; ' + stories + ' ' + esc(T(stories === 1 ? "story printed" : "stories printed")) +
                ' &middot; ' + esc(who) + '</div>' +
            '</div>';

    }

    function tabs() {

        const editor = state && state.is_editor;
        const list = [["page", T("THE FRONT PAGE")]];

        if (editor) { list.push(["desk", T("EDITOR'S DESK")]); }
        else if (state && state.leader) { list.push(["file", T("FILE A DISPATCH")]); }

        let h = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">';

        list.forEach(function(t, i) {
            const on = tab === t[0] || (i === 0 && tab !== "desk" && tab !== "file");
            let label = esc(t[1]);

            if (t[0] === "desk" && state.waiting) {
                label += ' <span style="color:#ffd37a">(' + Number(state.waiting) + ')</span>';
            }
            if (t[0] === "file" && state.mine && state.mine.length) {
                label += ' <span style="color:#ffd37a">(' + state.mine.length + ')</span>';
            }

            h += '<div data-gf="tab" data-t="' + t[0] + '" style="' + BTN +
                (on ? "color:#7dff9d;border-color:#4cff72;" : "") + '">' + label + '</div>';
        });

        return h + '</div>';
    }

    function byline(story) {

        const name = story.by || T("A commander");
        const office = story.role === "editor" ? T("the editor") : T(story.office || "");

        return T("by") + " " + name + (office ? ", " + office : "");

    }

    function story(story, lead) {

        const open = lead || unfolded[story.id];

        let h = '<div style="border-top:1px solid #183044;padding:10px 0" data-no-i18n>' +
            '<div style="font-size:' + (lead ? "21px" : "15px") + ';font-weight:900;letter-spacing:' +
                (lead ? "1px" : "0") + ';color:#fff;line-height:1.25">' + esc(story.headline) + '</div>';

        if (story.standfirst) {
            h += '<div style="color:#cfe6f5;font-style:italic;margin:5px 0">' + esc(story.standfirst) + '</div>';
        }

        if (story.image) {
            h += '<img src="' + esc(story.image) + '" alt="" ' +
                'style="max-width:100%;max-height:' + (lead ? "340px" : "170px") + ';display:block;' +
                'margin:7px 0;border:1px solid #2b4b61">';
        }

        if (story.caption) {
            h += '<div style="color:#7fa8c0;font-size:11px;margin-bottom:5px">' + esc(story.caption) + '</div>';
        }

        h += '<div style="color:#9fdcff;font-size:11px;letter-spacing:1px">' + esc(byline(story)) +
            ' &middot; ' + esc(when(story.published_at)) +
            (story.pinned ? ' &middot; ' + esc(T("LEAD STORY")) : "") +
            (story.edited ? ' &middot; ' + esc(T("rewritten by the editor")) : "") + '</div>';

        if (open) {
            h += '<div style="color:#dff1ff;margin-top:7px;line-height:1.55">' + para(story.body) + '</div>';
        }

        return h + '</div>';

    }

    function frontHtml() {

        const stories = (state && state.published) || [];

        if (!stories.length) {
            let note = T("The presses are cold: nothing has gone to print yet.");
            if (state && state.is_editor) { note += " " + T("Write the first story at the EDITOR'S DESK."); }
            else if (state && state.leader) { note += " " + T("Or file a dispatch: the editor decides."); }
            return '<div class="gf-news-note" style="color:#7fa8c0;line-height:1.6">' + esc(note) + '</div>';
        }

        return stories.map(function(s, i) {

            let h = story(s, i === 0);

            if (i > 0) {
                h += '<div data-gf="unfold" data-id="' + esc(s.id) + '" style="' + BTN +
                    'display:inline-block;margin-top:6px">' +
                    esc(T(unfolded[s.id] ? "CLOSE THE STORY" : "READ THE FULL STORY")) + '</div>';
            }

            return h;

        }).join("");

    }

    function composer(toolbar) {

        const d = draft || blank();
        const picture = localPicture ? localPicture.url : (d.image || "");

        let h = '<div class="gf-news-compose" style="border-top:1px solid #183044;margin-top:12px;padding-top:10px">' +
            '<div style="letter-spacing:2px;color:#9fdcff;margin-bottom:8px">' +
                esc(T(editing ? "REWRITE THE STORY" : "WRITE THE STORY")) + '</div>' +
            '<input type="text" data-gf="headline" maxlength="140" placeholder="' + esc(T("headline")) +
                '" value="' + esc(d.headline) + '" style="' + FIELD + '">' +
            '<input type="text" data-gf="standfirst" maxlength="240" placeholder="' +
                esc(T("the line under the headline")) + '" value="' + esc(d.standfirst) + '" style="' + FIELD + '">' +
            '<textarea data-gf="body" rows="7" placeholder="' + esc(T("the story itself")) +
                '" style="' + FIELD + ';resize:vertical">' + esc(d.body) + '</textarea>' +
            '<input type="text" data-gf="image" placeholder="' + esc(T("a picture: paste its link")) +
                '" value="' + esc(d.image) + '" style="' + FIELD + '">' +
            '<input type="text" data-gf="caption" maxlength="200" placeholder="' +
                esc(T("what the picture shows")) + '" value="' + esc(d.caption) + '" style="' + FIELD + '">';

        if (picture) {
            h += '<div data-no-i18n style="margin-bottom:8px"><img src="' + esc(picture) + '" alt="" ' +
                'style="max-width:100%;max-height:220px;border:1px solid #2b4b61"></div>';
        }

        if (localPicture) {
            h += '<div style="color:#e8c46a;margin-bottom:8px">' + esc(T("LOCAL PICTURE")) + ': ' +
                esc(localPicture.name) + ' — ' +
                esc(T("it shows here only unless it can be uploaded")) + '</div>';
        }

        h += '<div style="display:flex;gap:6px;flex-wrap:wrap">' + toolbar +
            '<label style="' + BTN + '">' + esc(T("PICK A PICTURE")) +
            '<input type="file" accept="image/*" data-gf="picture" style="display:none"></label>' +
            '</div>';

        return h + '</div>';

    }

    function trayHtml() {

        const tray = (state && state.tray) || [];

        let h = '<div style="letter-spacing:2px;color:#9fdcff;margin:16px 0 6px">' +
            esc(T("THE EDITOR'S TRAY")) + '</div>';

        if (!tray.length) {
            return h + '<div style="color:#7fa8c0">' + esc(T("Nothing has been filed: the tray is empty.")) + '</div>';
        }

        return h + tray.map(function(a) {

            let item = '<div style="border-top:1px solid #183044;padding:10px 0">' +
                '<div style="color:#fff;font-weight:bold">' + esc(a.headline) + '</div>' +
                '<div style="color:#9fdcff;font-size:11px;letter-spacing:1px;margin:3px 0">' +
                    esc(a.by || "") + (a.office ? ", " + esc(T(a.office)) : "") + ' &middot; ' +
                    esc(when(a.submitted_at)) + '</div>';

            if (a.standfirst) { item += '<div style="color:#cfe6f5;font-style:italic;margin:4px 0">' + esc(a.standfirst) + '</div>'; }
            if (a.image) { item += '<img src="' + esc(a.image) + '" alt="" style="max-width:100%;max-height:180px;border:1px solid #2b4b61;margin:5px 0">'; }
            if (a.body) { item += '<div style="color:#dff1ff;line-height:1.5;margin:5px 0">' + para(a.body) + '</div>'; }

            item += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
                '<div data-gf="print" data-id="' + esc(a.id) + '" style="' + BTN + 'color:#7dff9d;border-color:#4cff72">' +
                    esc(T("PRINT IT")) + '</div>' +
                '<div data-gf="rewrite" data-id="' + esc(a.id) + '" style="' + BTN + '">' +
                    esc(T("REWRITE IT")) + '</div>' +
                '<div data-gf="refuse" data-id="' + esc(a.id) + '" style="' + BTN + 'color:#ffb0b0;border-color:#8a3030">' +
                    esc(T("TURN IT DOWN")) + '</div>' +
                '<div data-gf="remove" data-id="' + esc(a.id) + '" style="' + BTN + '">' + esc(T("BURN IT")) + '</div>' +
                '</div></div>';

            return item;

        }).join("");

    }

    function printedHtml() {

        const stories = (state && state.published) || [];

        let h = '<div style="letter-spacing:2px;color:#9fdcff;margin:16px 0 6px">' +
            esc(T("WHAT IS ON THE PAGE")) + '</div>';

        if (!stories.length) { return h + '<div style="color:#7fa8c0">' + esc(T("The page is empty.")) + '</div>'; }

        return h + stories.map(function(a) {

            return '<div style="display:flex;gap:8px;align-items:center;border-top:1px solid #183044;padding:8px 0">' +
                '<div style="flex:1;color:#dff1ff">' + esc(a.headline) +
                    '<div style="color:#7fa8c0;font-size:11px">' + esc(byline(a)) + '</div></div>' +
                '<div data-gf="lead" data-id="' + esc(a.id) + '" data-on="' + (a.pinned ? "1" : "0") + '" style="' + BTN + '">' +
                    esc(T(a.pinned ? "IT IS THE LEAD" : "MAKE IT THE LEAD")) + '</div>' +
                '<div data-gf="rewrite" data-id="' + esc(a.id) + '" style="' + BTN + '">' + esc(T("REWRITE")) + '</div>' +
                '<div data-gf="spike" data-id="' + esc(a.id) + '" style="' + BTN + '">' + esc(T("OFF THE FRONT PAGE")) + '</div>' +
                '<div data-gf="remove" data-id="' + esc(a.id) + '" style="' + BTN + '">' + esc(T("BURN IT")) + '</div>' +
                '</div>';

        }).join("");

    }

    function deskHtml() {

        const compose = composer(
            '<div data-gf="publish" style="' + BTN + 'color:#7dff9d;border-color:#4cff72">' +
                esc(T(editing ? "SAVE THE STORY" : "PUBLISH IT")) + '</div>' +
            (editing ? '<div data-gf="blank" style="' + BTN + '">' + esc(T("START A NEW STORY")) + '</div>' : "") +
            (state.waiting ? '<div data-gf="clear" style="' + BTN + 'color:#ffb0b0;border-color:#8a3030">' +
                esc(T("EMPTY THE TRAY")) + '</div>' : "")
        );

        return compose + trayHtml() + printedHtml();

    }

    function fileHtml() {

        const mine = (state && state.mine) || [];
        const printed = Number((state && state.my_published) || 0);

        let h = composer(
            '<div data-gf="file" style="' + BTN + 'color:#7dff9d;border-color:#4cff72">' +
                esc(T("SEND IT TO THE EDITOR")) + '</div>' +
            (editing || (draft && (draft.headline || draft.body))
                ? '<div data-gf="blank" style="' + BTN + '">' + esc(T("START AGAIN")) + '</div>' : "")
        );

        h += '<div style="letter-spacing:2px;color:#9fdcff;margin:16px 0 6px">' + esc(T("YOUR DISPATCHES")) + '</div>';
        h += '<div style="color:#7fa8c0;margin-bottom:6px">' +
            Number(printed) + ' ' + esc(T(printed === 1 ? "of your dispatches is on the front page" : "of your dispatches are on the front page")) +
            '</div>';

        if (!mine.length) {
            return h + '<div style="color:#7fa8c0">' + esc(T("You have filed nothing yet.")) + '</div>';
        }

        return h + mine.map(function(a) {

            const colour = a.status === "refused" ? "#ffb0b0" : "#ffd37a";

            return '<div style="border-top:1px solid #183044;padding:9px 0">' +
                '<div style="color:#fff;font-weight:bold">' + esc(a.headline) +
                    ' <span style="color:' + colour + ';font-size:11px;letter-spacing:1px">' +
                    esc(statusWord(a.status)) + '</span></div>' +
                '<div style="color:#7fa8c0;font-size:11px">' + esc(when(a.submitted_at)) + '</div>' +
                (a.note ? '<div style="color:#ffd37a;margin-top:4px">' + esc(T("The editor's note:")) + ' ' +
                    esc(a.note) + '</div>' : "") +
                '<div style="display:flex;gap:6px;margin-top:6px">' +
                '<div data-gf="rewrite" data-id="' + esc(a.id) + '" style="' + BTN + '">' + esc(T("REWRITE IT")) + '</div>' +
                '<div data-gf="withdraw" data-id="' + esc(a.id) + '" style="' + BTN + '">' + esc(T("TAKE IT BACK")) + '</div>' +
                '</div></div>';

        }).join("");

    }

    function clue() {
        return '<div style="color:#e8c46a;line-height:1.6">' +
            esc(T("The front page has not been set up yet: run")) + ' ' + esc(PATCH) +
            ' , ' + esc(T("then reload the page.")) + '</div>';
    }

    function bodyHtml() {

        if (missing) { return clue(); }
        if (!live) { return '<div style="color:#7fa8c0">' + esc(T("Talking to the printing press...")) + '</div>'; }

        let h = masthead() + tabs();

        if (tab === "desk" && state.is_editor) { h += deskHtml(); }
        else if (tab === "file" && state.leader && !state.is_editor) { h += fileHtml(); }
        else { h += frontHtml(); }

        return '<div class="gf-news-note" style="color:#7fa8c0;min-height:16px;margin:8px 0"></div>' + h;

    }

    /* ---------- drawing ---------- */

    function draw(target) {

        if (!target) { return; }

        target.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
                '<b style="letter-spacing:2px;color:#9fdcff">' + esc(T("THE FRONT PAGE")) + '</b>' +
                '<button type="button" data-gf="close" style="background:none;border:none;color:#7b93a6;' +
                'cursor:pointer;font-size:16px">&times;</button></div>' +
            '<div data-gf="paper">' + bodyHtml() + '</div>';

        wire(target);

    }

    function paint() {

        if (needed()) { build(); }

        views = views.filter(function(el) { return el.el && el.el.isConnected; });

        views.forEach(function(v) { draw(v.el); });

        if (button) {
            const waiting = (state && state.is_editor) ? Number(state.waiting || 0) : 0;
            button.style.borderColor = waiting > 0 ? "#ff5a2a" : (live ? "#3f7f9f" : "#3f5f7f");
            button.title = waiting > 0
                ? T("The front page") + " — " + waiting + " " + T(waiting === 1 ? "dispatch waiting" : "dispatches waiting")
                : T("The front page");
        }

    }

    /* ---------- the panel ---------- */

    function known() {
        if (live || missing) { return true; }
        const status = window.gameStatus;
        return !!(status && typeof status.is_host === "boolean");
    }

    function hostByStatus() {
        const status = window.gameStatus;
        return !!(status && status.is_host === true);
    }

    /*
       Everybody who is signed in may read the paper; before the presses
       have answered there is nothing to show, and on a database without
       the patch only the host is given the clue.
    */
    function needed() {
        if (live) { return true; }
        return missing && hostByStatus();
    }

    function build() {

        if (button || !document.body) { return; }

        button = document.createElement("button");
        button.type = "button";
        button.id = "gf-news-button";
        button.textContent = "\ud83d\udcf0";
        button.title = T("The front page");
        button.style.cssText =
            "position:fixed;right:66px;bottom:18px;z-index:1200;width:40px;height:40px;border-radius:50%;" +
            "background:rgba(10,18,28,.92);color:#9fdcff;border:1px solid #3f7f9f;font-size:18px;line-height:1;" +
            "cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.5);";
        document.body.appendChild(button);

        panel = document.createElement("div");
        panel.id = "gf-news-panel";
        panel.style.cssText =
            "position:fixed;right:18px;bottom:68px;z-index:1201;width:min(880px,94vw);max-height:84vh;overflow:auto;" +
            "display:none;background:rgba(8,14,22,.97);border:1px solid #3f7f9f;padding:16px;" +
            "font:12px Arial;color:#cfe6f5;box-shadow:0 10px 30px rgba(0,0,0,.6);";
        panelBody = document.createElement("div");
        panel.appendChild(panelBody);
        document.body.appendChild(panel);

        button.addEventListener("click", function() {
            const opening = panel.style.display === "none";
            panel.style.display = opening ? "block" : "none";
            if (opening) { show(panelBody); refresh(); }
            else { drop(panelBody); }
        });

        document.addEventListener("keydown", function(e) {
            if (e.key === "Escape" && panel.style.display !== "none") {
                panel.style.display = "none";
                drop(panelBody);
            }
        });

    }

    function show(el) {
        if (!views.some(function(view) { return view.el === el; })) { views.push({ el: el }); }
        draw(el);
        if (live || missing) { return; }
        refresh();
    }

    function drop(el) {
        views = views.filter(function(v) { return v.el !== el; });
    }

    /* ---------- the controls ---------- */

    function wire(target) {

        target.querySelectorAll("[data-gf]").forEach(function(el) {

            const kind = el.dataset.gf;

            if (kind === "headline" || kind === "standfirst" || kind === "body" ||
                kind === "image" || kind === "caption" || kind === "picture") { return; }

            el.addEventListener("click", function() {

                if (kind === "close") {
                    if (panel) { panel.style.display = "none"; drop(panelBody); }
                    return;
                }

                if (kind === "tab") { tab = el.dataset.t; readComposer(target); paint(); return; }

                if (kind === "unfold") {
                    const id = el.dataset.id;
                    if (unfolded[id]) { delete unfolded[id]; } else { unfolded[id] = true; }
                    paint();
                    return;
                }

                if (kind === "publish") { sendStory(true); return; }
                if (kind === "file") { sendStory(false); return; }

                if (kind === "blank") { beginStory(null); return; }

                if (kind === "print") {
                    readComposer(target);
                    act("news_publish", { p_id: el.dataset.id });
                    return;
                }

                if (kind === "refuse") {
                    const why = window.prompt(T("Tell the desk why it is not going in (or leave it empty):"), "");
                    if (why === null) { return; }
                    act("news_refuse", { p_id: el.dataset.id, p_note: why });
                    return;
                }

                if (kind === "spike") { act("news_spike", { p_id: el.dataset.id }); return; }
                if (kind === "remove") { act("news_remove", { p_id: el.dataset.id }); return; }
                if (kind === "withdraw") { act("news_withdraw", { p_id: el.dataset.id }); return; }
                if (kind === "clear") { act("news_clear_trays"); return; }

                if (kind === "lead") {
                    act("news_pin", { p_id: el.dataset.id, p_pinned: el.dataset.on !== "1" });
                    return;
                }

                if (kind === "rewrite") {

                    const all = ((state && state.tray) || []).concat((state && state.published) || [])
                        .concat((state && state.mine) || []);

                    let found = null;
                    all.forEach(function(a) { if (String(a.id) === String(el.dataset.id)) { found = a; } });

                    if (!found && editing && String(editing) !== String(el.dataset.id)) {
                        /* asking to rewrite a second story: start from what was typed */
                        found = { id: el.dataset.id, headline: draft ? draft.headline : "",
                                  standfirst: draft ? draft.standfirst : "", body: draft ? draft.body : "",
                                  image: draft ? draft.image : "", caption: draft ? draft.caption : "" };
                    }

                    if (found) { tab = (state && state.is_editor) ? "desk" : "file"; beginStory(found); }

                }

            });

        });

        target.querySelectorAll('[data-gf="picture"]').forEach(function(input) {
            input.addEventListener("change", function() {
                readComposer(target);
                const picked = input.files && input.files[0];
                if (picked) { pickPicture(picked); }
            });
        });

        /* what is being written survives every redraw, and the poll */
        ["headline", "standfirst", "body", "image", "caption"].forEach(function(name) {
            const input = target.querySelector('[data-gf="' + name + '"]');
            if (!input) { return; }
            input.addEventListener("input", function() {
                if (!draft) { draft = blank(); }
                draft[name] = input.value;
            });
        });

    }

    /* ---------- boot ---------- */

    function start() {
        if (timer) { return; }
        refresh();
        timer = setInterval(function() { if (live || missing) { refresh(); } }, POLL_MS);
    }

    function boot() {

        if (known()) { start(); return; }

        /* who the host is only becomes known when gamecontrol.js has heard
           its first heartbeat, which it writes to window.gameStatus */
        const waiter = setInterval(function() {
            tries++;
            if (known()) { clearInterval(waiter); start(); }
            else if (tries > 120) { clearInterval(waiter); }
        }, 500);

    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    }
    else {
        boot();
    }

    /* other screens — the two chambers — draw the paper inside their own tab */
    window.GFNews = {
        render: function(el) {
            if (!el) { return; }
            show(el);
        },
        open: function() {
            build();
            if (!panel) { return; }
            panel.style.display = "block";
            show(panelBody);
        },
        refresh: refresh,
        state: function() { return state; },
        waiting: function() { return (state && Number(state.waiting)) || 0; },
        printed: function() { return (state && state.published) || []; },
        host: function() { return !!(state && state.is_editor) || hostByStatus(); }
    };

})();
