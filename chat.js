/* =========================================================
   GALACTIC FRONT — the airwaves
   One panel, three channels:

     GLOBAL   everybody in the war
     TEAM     your own side only
     PRIVATE  a whisper between two commanders

   The traffic lives in the database (sql/2026-11-53_the_airwaves.sql) and is
   read through the functions: the table itself is closed. This file only
   draws it and keeps it current while the panel is open.

   No dependencies: included by every screen.
========================================================= */

(function () {

    "use strict";

    const POLL_MS = 6000;

    const BTN = "background:#0e2233;color:#bfe4ff;border:1px solid #2f6280;padding:4px 8px;" +
                "font:11px Arial;cursor:pointer;";

    let panel = null;
    let button = null;
    let tab = "global";        /* which channel is on */
    let people = [];           /* who a whisper may go to */
    let withWhom = null;       /* the commander the private tab is open on */
    let messages = [];         /* what the last fetch brought */
    let me = null;             /* this player, as the database sees them */
    let error = null;          /* the server's answer, when it refuses */
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

    function client() {
        try {
            if (typeof supabaseClient !== "undefined" && supabaseClient &&
                typeof supabaseClient.rpc === "function") {
                return supabaseClient;
            }
        }
        catch (e) { /* the client arrives with supabase.js */ }

        const other = window.supabaseClient;
        return (other && typeof other.rpc === "function") ? other : null;
    }

    function call(name, args) {
        const c = client();
        if (!c) { return Promise.resolve({ data: null, error: { message: "Not signed in" } }); }
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

    function clock(at) {

        const when = new Date(at);
        if (isNaN(when.getTime())) { return ""; }

        const pad = function(n) { return (n < 10 ? "0" : "") + n; };
        return pad(when.getHours()) + ":" + pad(when.getMinutes());

    }

    /* ---------- the panel ---------- */

    function build() {

        if (button) { return; }

        button = document.createElement("button");
        button.type = "button";
        button.id = "gf-chat-button";
        button.textContent = "\uD83D\uDCAC";
        button.title = T("The airwaves");
        button.style.cssText =
            "position:fixed;right:66px;bottom:18px;z-index:1200;width:40px;height:40px;border-radius:50%;" +
            "background:rgba(10,18,28,.92);color:#9fdcff;border:1px solid #3f7f9f;font-size:18px;line-height:1;" +
            "cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.5);";
        document.body.appendChild(button);

        panel = document.createElement("div");
        panel.id = "gf-chat-panel";
        panel.style.cssText =
            "position:fixed;right:66px;bottom:68px;z-index:1201;width:344px;max-height:62vh;display:none;" +
            "background:rgba(8,14,22,.98);border:1px solid #3f7f9f;padding:12px;font:12px Arial;" +
            "color:#cfe6f5;box-shadow:0 10px 30px rgba(0,0,0,.6);";
        document.body.appendChild(panel);

        button.addEventListener("click", function() {
            if (panel.style.display === "none") { open(); }
            else { close(); }
        });

        document.addEventListener("keydown", function(e) {
            if (e.key === "Escape" && panel.style.display !== "none") { close(); }
        });

    }

    function open() {
        build();
        panel.style.display = "block";
        paintAll();
        start();
        loadPeople().then(function() { paintPeople(); return reload(); });
    }

    function close() {
        if (panel) { panel.style.display = "none"; }
    }

    function start() {

        if (timer) { return; }

        timer = setInterval(function() {
            if (panel && panel.style.display === "block") { reload(); paintPeople(); }
        }, POLL_MS);

    }

    /* ---------- what the server says ---------- */

    function loadPeople() {

        return call("chat_people").then(function(res) {

            if (res.error) { error = reason(res.error); return; }

            people = (res.data && Array.isArray(res.data.people)) ? res.data.people : [];

            if (!withWhom && people.length) { withWhom = people[0].id; }

        });

    }

    function reload() {

        if (tab === "private" && !withWhom) {
            messages = [];
            paintMessages();
            return Promise.resolve();
        }

        const args = { p_channel: tab };

        if (tab === "private") { args.p_with = withWhom; }

        return call("chat_fetch", args).then(function(res) {

            if (res.error) {
                error = reason(res.error);
                messages = [];
            }
            else {
                error = null;
                messages = (res.data && Array.isArray(res.data.messages)) ? res.data.messages : [];
                if (res.data && res.data.me) { me = res.data.me; }
            }

            paintMessages();

        });

    }

    function send() {

        if (!panel) { return; }

        const input = panel.querySelector('[data-gf="chat-input"]');
        const body = input ? input.value.trim() : "";

        if (!body) { input && input.focus(); return; }

        const args = { p_channel: tab, p_body: body };

        if (tab === "private") {

            if (!withWhom) {
                error = T("Choose a commander first");
                paintMessages();
                return;
            }

            args.p_to = withWhom;

        }

        const sendButton = panel.querySelector('[data-gf="chat-send"]');
        if (sendButton) { sendButton.disabled = true; }

        call("chat_send", args).then(function(res) {

            if (sendButton) { sendButton.disabled = false; }

            if (res.error) {
                error = reason(res.error);
                paintMessages();
                return;
            }

            if (input) { input.value = ""; }
            error = null;
            reload();

        });

    }

    /* ---------- drawing ---------- */

    function paintAll() {

        if (!panel) { return; }

        const tabs = [["global", "GLOBAL"], ["team", "TEAM"], ["private", "PRIVATE"]];

        let h = '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<b style="letter-spacing:3px;color:#9fdcff">' + esc(T("THE AIRWAVES")) + '</b>' +
            '<button type="button" data-gf="chat-close" style="background:none;border:none;color:#7b93a6;' +
            'cursor:pointer;font-size:16px">&times;</button></div>';

        h += '<div style="display:flex;gap:4px;margin:10px 0 8px">' +
            tabs.map(function(t) {
                const on = t[0] === tab;
                return '<button type="button" data-gf="chat-tab" data-tab="' + t[0] + '" style="' + BTN +
                    (on ? ';color:#7dffb0;border-color:#37c98a' : '') + '">' + esc(T(t[1])) + '</button>';
            }).join("") + '</div>';

        h += '<div data-gf="chat-roster"></div>' +
            '<div data-gf="chat-list" style="max-height:34vh;overflow:auto;border-top:1px solid #183044;' +
            'border-bottom:1px solid #183044;padding:6px 0;margin-bottom:8px"></div>' +
            '<div data-gf="chat-status" style="color:#8a6a3a;min-height:14px;margin-bottom:6px"></div>' +
            '<div style="display:flex;gap:6px">' +
            '<input type="text" data-gf="chat-input" maxlength="400" placeholder="' + esc(T("Write a message")) +
            '" style="flex:1;min-width:0;padding:6px;background:#0b1622;border:1px solid #2b4b61;color:#dff1ff">' +
            '<button type="button" data-gf="chat-send" style="' + BTN + '">' + esc(T("SEND")) + '</button>' +
            '</div>';

        panel.innerHTML = h;

        wire();
        paintPeople();
        paintMessages();

    }

    function paintPeople() {

        const slot = panel && panel.querySelector('[data-gf="chat-roster"]');
        if (!slot) { return; }

        if (tab !== "private") { slot.innerHTML = ""; return; }

        if (!people.length) {
            slot.innerHTML = '<div style="color:#7fa8c0;margin-bottom:8px">' +
                esc(T("Nobody else is at the table yet.")) + '</div>';
            return;
        }

        slot.innerHTML = '<select data-gf="chat-who" style="width:100%;padding:5px;margin-bottom:8px;' +
            'background:#0b1622;border:1px solid #2b4b61;color:#dff1ff;font:12px Arial">' +
            people.map(function(p) {
                return '<option value="' + esc(p.id) + '"' + (p.id === withWhom ? " selected" : "") + ">" +
                    esc(p.name) + (p.online ? " \u2022 " + esc(T("online")) : "") +
                    (p.faction ? " \u2014 " + esc(T(p.faction)) : "") + '</option>';
            }).join("") + '</select>';

        const select = slot.querySelector('[data-gf="chat-who"]');

        if (select) {

            select.addEventListener("change", function() {
                withWhom = select.value;
                reload();
            });

        }

    }

    function paintMessages() {

        if (!panel) { return; }

        const list = panel.querySelector('[data-gf="chat-list"]');
        const status = panel.querySelector('[data-gf="chat-status"]');

        if (status) {
            status.textContent = error
                ? error
                : (tab === "private" && !withWhom ? T("Choose a commander first") : "");
            status.style.color = error ? "#ff9b9b" : "#8a6a3a";
        }

        if (!list) { return; }

        if (!messages.length) {
            list.innerHTML = '<div style="color:#6f8ba0;padding:4px 2px">' +
                esc(T("Nothing has been said here yet.")) + '</div>';
            return;
        }

        list.innerHTML = messages.map(function(m) {

            const mine = me && String(m.sender) === String(me);
            const who = mine ? T("You") : (m.name || T("Commander"));

            return '<div style="padding:3px 2px;line-height:1.45">' +
                '<span style="color:' + (mine ? "#7dffb0" : "#9fdcff") + ';font-weight:bold">' + esc(who) + '</span>' +
                '<span style="color:#557a92"> \u00b7 ' + esc(clock(m.at)) + '</span>' +
                '<div style="color:#d6e6f2;white-space:pre-wrap;word-break:break-word">' + esc(m.body) + '</div>' +
                '</div>';

        }).join("");

        list.scrollTop = list.scrollHeight;

    }

    function wire() {

        panel.querySelectorAll('[data-gf]').forEach(function(el) {

            const kind = el.dataset.gf;

            if (kind === "chat-tab") {

                el.addEventListener("click", function() {
                    if (tab === el.dataset.tab) { return; }
                    tab = el.dataset.tab;
                    messages = [];
                    paintAll();
                    reload();
                });

            }

            if (kind === "chat-close") {
                el.addEventListener("click", close);
            }

            if (kind === "chat-send") {
                el.addEventListener("click", send);
            }

        });

        const input = panel.querySelector('[data-gf="chat-input"]');

        if (input) {
            input.addEventListener("keydown", function(e) {
                if (e.key === "Enter") { e.preventDefault(); send(); }
            });
        }

    }

    /* ---------- boot ---------- */

    function boot() {

        build();

        /* the panel is offered as soon as there is a client to talk to */
        const waiter = setInterval(function() {
            tries++;
            if (client() || tries > 120) {
                clearInterval(waiter);
                if (!client()) { return; }
                button.style.display = "block";
            }
        }, 500);

    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    }
    else {
        boot();
    }

    /* the other screens may open it; they get no new powers */
    window.GFChat = {
        open: open,
        close: close,
        unread: function() { return 0; }
    };

})();
