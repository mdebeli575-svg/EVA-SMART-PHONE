/* EVA Mobile live customer assistant bar (guided support + callback handoff). */
(function () {
    "use strict";

    const EVA = window.EVA || {};
    const request = EVA.request;
    const escapeHtml = EVA.escapeHtml || function (v) {
        return String(v == null ? "" : v)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    };
    const formatBirr = EVA.formatBirr || function (n) { return Number(n || 0).toLocaleString("en-US") + " ETB"; };

    const AGENT_KEY = "eva.assistant.agentName";
    const DM_CODE_KEY = "eva.dm.threadCode";
    const DM_PHONE_KEY = "eva.dm.phone";
    const DM_NAME_KEY = "eva.dm.name";
    const state = {
        settings: null,
        products: [],
        open: false,
        busy: false,
        stage: "idle",
        draft: {},
        dmThread: null
    };

    const $ = (s, r) => (r || document).querySelector(s);

    function agentName() {
        try { return localStorage.getItem(AGENT_KEY) || ""; } catch (_) { return ""; }
    }
    function setAgentName(name) {
        try {
            if (name) localStorage.setItem(AGENT_KEY, name);
            else localStorage.removeItem(AGENT_KEY);
        } catch (_) { /* ignore */ }
    }

    function nowTime() {
        return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    function appendMessage(role, html, plainText) {
        const log = $("#assistantLog");
        if (!log) return;
        const wrap = document.createElement("div");
        wrap.className = "assistant-msg " + (role === "user" ? "is-user" : "is-bot");
        const meta = role === "user" ? "You" : (agentName() ? "Live assistant · " + agentName() : "Live assistant");
        wrap.innerHTML =
            '<div class="assistant-bubble">' + html + '</div>' +
            '<span class="assistant-meta">' + escapeHtml(meta) + " · " + escapeHtml(nowTime()) + "</span>";
        if (plainText) wrap.dataset.text = plainText;
        log.appendChild(wrap);
        log.scrollTop = log.scrollHeight;
    }

    function typing(on) {
        const log = $("#assistantLog");
        if (!log) return;
        let node = $("#assistantTyping", log);
        if (on) {
            if (node) return;
            node = document.createElement("div");
            node.id = "assistantTyping";
            node.className = "assistant-msg is-bot is-typing";
            node.innerHTML = '<div class="assistant-bubble"><span class="dots"><i></i><i></i><i></i></span> Live assistant is typing…</div>';
            log.appendChild(node);
            log.scrollTop = log.scrollHeight;
        } else if (node) {
            node.remove();
        }
    }

    function setQuick(actions) {
        const box = $("#assistantQuick");
        if (!box) return;
        box.innerHTML = (actions || []).map((a) =>
            '<button type="button" class="assistant-chip" data-action="' + escapeHtml(a.action) + '"' +
            (a.value ? ' data-value="' + escapeHtml(a.value) + '"' : "") + ">" + escapeHtml(a.label) + "</button>"
        ).join("");
    }

    function normalize(text) {
        return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
    }

    function includesAny(text, words) {
        return words.some((w) => text.indexOf(w) !== -1);
    }

    function contactSummary() {
        const s = state.settings || {};
        const p1 = s.phone1 || "0912 159 265";
        const p2 = s.phone2 || "0919 117 325";
        const addr = s.addressFull || s.addressTopbar || "Megenagna, Fiteh Building, Ground B2, Addis Ababa";
        const hrs = (s.hoursWeekday || "Mon–Sat 8:30–20:00") + " · " + (s.hoursSunday || "Sun 9:00–19:00");
        return { p1, p2, addr, hrs };
    }

    function answerFor(text) {
        const t = normalize(text);
        const c = contactSummary();

        if (includesAny(t, ["hello", "hi", "hey", "selam", "good morning", "good afternoon", "good evening"])) {
            return {
                html: "Hi! I’m your <strong>live customer support assistant</strong> for EVA SMART PHONE. I can help with products, prices, delivery, payments, order tracking, or connect you to our call center.",
                quick: defaultQuick()
            };
        }
        if (includesAny(t, ["track", "order status", "where is my order", "reference", "eva-"])) {
            const refMatch = String(text || "").toUpperCase().match(/EVA-[A-Z0-9]{4,}/);
            if (refMatch) {
                return {
                    html: "I can check that for you. Opening order tracking for <strong>" + escapeHtml(refMatch[0]) + "</strong>…",
                    run: () => { if (typeof window.openTrack === "function") window.openTrack(refMatch[0]); }
                };
            }
            return {
                html: "To track an order, share your reference (example: <code>EVA-7F3K2A</code>) or use the tracking form. I can open it for you now.",
                quick: [{ label: "Open order tracking", action: "track" }].concat(defaultQuick())
            };
        }
        if (includesAny(t, ["deliver", "shipping", "ship", "how long", "same day"])) {
            return {
                html: "We offer <strong>fast delivery in Addis Ababa</strong> (often same day, typically within 24–48h depending on location). Delivery details are confirmed by phone after checkout. Share your area if you want, and I can help you place the order.",
                quick: defaultQuick()
            };
        }
        if (includesAny(t, ["pay", "payment", "telebirr", "cbe", "birr", "cash"])) {
            return {
                html: "You can pay securely with <strong>Telebirr</strong> or <strong>CBE Birr</strong> during checkout. For in-shop purchases, ask our team about available options. Need help completing a payment?",
                quick: defaultQuick()
            };
        }
        if (includesAny(t, ["hour", "open", "close", "time", "when"])) {
            return {
                html: "Our opening hours are: <strong>" + escapeHtml(c.hrs) + "</strong>.",
                quick: defaultQuick()
            };
        }
        if (includesAny(t, ["location", "address", "where", "megenagna", "shop", "store", "map"])) {
            return {
                html: "You can visit us at: <strong>" + escapeHtml(c.addr) + "</strong>. I can also point you to the contact/map section.",
                quick: [{ label: "View contact & map", action: "contact" }].concat(defaultQuick())
            };
        }
        if (includesAny(t, ["message", "dm", "chat with admin", "direct message", "inbox", "reply from admin"])) {
            const saved = getSavedDm();
            return {
                html: "You can send a <strong>direct message to admin</strong> here. " + (saved.threadCode ? "I found a saved conversation (<code>" + escapeHtml(saved.threadCode) + "</code>) you can continue." : "Start a new message and I’ll give you a thread code to track replies."),
                quick: (saved.threadCode && saved.phone ? [{ label: "Continue my DM", action: "dm-open" }] : []).concat([{ label: "Start new DM", action: "dm-start" }, { label: "Request callback", action: "callback" }])
            };
        }
        if (includesAny(t, ["call", "phone", "contact", "number", "whatsapp", "telegram", "human", "agent", "support"])) {
            return {
                html: "You can reach us at <a href=\"tel:" + escapeHtml(c.p1.replace(/\s/g, "")) + "\">" + escapeHtml(c.p1) + "</a> or <a href=\"tel:" + escapeHtml(c.p2.replace(/\s/g, "")) + "\">" + escapeHtml(c.p2) + "</a>. For a live follow-up, I can submit a <strong>callback request</strong> or you can send a <strong>direct message to admin</strong>.",
                quick: [{ label: "Request callback", action: "callback" }, { label: "Message admin (DM)", action: "dm-start" }, { label: "Open call center", action: "callcenter" }]
            };
        }
        if (includesAny(t, ["warranty", "guarantee", "return", "repair", "original", "genuine"])) {
            return {
                html: "We sell <strong>100% original devices</strong> with warranty support. You can check the device before paying, and we assist with after-sales support at the same shop. For a specific case, request a callback and our team will help.",
                quick: [{ label: "Request callback", action: "callback" }].concat(defaultQuick())
            };
        }
        if (includesAny(t, ["price", "cost", "how much", "iphone", "samsung", "tecno", "infinix", "redmi", "phone", "accessor", "charger", "earbud", "stock", "available"])) {
            const match = findProductMention(t);
            if (match) {
                const stock = match.stock > 0 ? (match.stock <= 3 ? "Only " + match.stock + " left" : "In stock") : "Currently out of stock";
                return {
                    html: "<strong>" + escapeHtml(match.name) + "</strong> (" + escapeHtml(match.brand || "") + ") is <strong>" + escapeHtml(formatBirr(match.price)) + "</strong>. " + escapeHtml(stock) + ".",
                    quick: [{ label: "Browse products", action: "products" }, { label: "Request callback", action: "callback" }]
                };
            }
            return {
                html: "I can help you find phones and accessories from our current catalogue. Browse the products section or tell me the model/brand you’re looking for.",
                quick: [{ label: "Browse smartphones", action: "products", value: "SMARTPHONE" }, { label: "Browse accessories", action: "products", value: "ACCESSORY" }, { label: "Request callback", action: "callback" }]
            };
        }
        if (includesAny(t, ["3d", "model", "rotate", "view"])) {
            return {
                html: "This site now includes a <strong>3D interactive hero experience</strong> on the homepage. You can move your pointer/touch over the hero area to explore the 3D view.",
                quick: [{ label: "Go to top", action: "home" }].concat(defaultQuick())
            };
        }
        if (includesAny(t, ["agent", "set name", "my name", "assistant name", "i am", "i'm"])) {
            return {
                html: "If you’re joining as support staff on this device, I can set your assistant display name for this live bar.",
                quick: [{ label: "Set assistant name", action: "set-agent" }, { label: "Clear assistant name", action: "clear-agent" }]
            };
        }

        return {
            html: "I can help with <strong>products</strong>, <strong>prices/stock</strong>, <strong>delivery</strong>, <strong>payments</strong>, <strong>hours</strong>, and <strong>order tracking</strong>. For anything specific, I can connect you to a live person via callback.",
            quick: defaultQuick()
        };
    }

    function getSavedDm() {
        try {
            return {
                threadCode: localStorage.getItem(DM_CODE_KEY) || "",
                phone: localStorage.getItem(DM_PHONE_KEY) || "",
                name: localStorage.getItem(DM_NAME_KEY) || ""
            };
        } catch (_) { return { threadCode: "", phone: "", name: "" }; }
    }
    function saveDm(threadCode, phone, name) {
        try {
            if (threadCode) localStorage.setItem(DM_CODE_KEY, threadCode); else localStorage.removeItem(DM_CODE_KEY);
            if (phone) localStorage.setItem(DM_PHONE_KEY, phone); else localStorage.removeItem(DM_PHONE_KEY);
            if (name) localStorage.setItem(DM_NAME_KEY, name); else localStorage.removeItem(DM_NAME_KEY);
        } catch (_) { /* ignore */ }
    }

    function defaultQuick() {
        const saved = getSavedDm();
        const quick = [
            { label: "Track order", action: "track" },
            { label: "Delivery & payment", action: "ask", value: "delivery and payment" },
            { label: "Shop hours", action: "ask", value: "opening hours" },
            { label: "Request callback", action: "callback" },
            { label: "Message admin (DM)", action: "dm-start" }
        ];
        if (saved.threadCode && saved.phone) {
            quick.splice(4, 0, { label: "Continue my DM", action: "dm-open" });
        }
        return quick;
    }

    function renderDmThread(thread) {
        if (!thread) return;
        state.dmThread = thread;
        saveDm(thread.threadCode, thread.customerPhone || getSavedDm().phone, thread.customerName || getSavedDm().name);
        const msgs = thread.messages || [];
        const lines = msgs.slice(-8).map((m) => {
            const who = m.sender === "ADMIN" ? "Admin" : "You";
            return "<div style='margin:.2rem 0'><strong>" + escapeHtml(who) + ":</strong> " + escapeHtml(m.body || "") + "</div>";
        }).join("");
        const status = thread.status ? " · " + escapeHtml(thread.status) : "";
        appendMessage("bot",
            "Conversation <strong>" + escapeHtml(thread.threadCode) + "</strong>" + status
            + "<div style='margin-top:.45rem;padding:.55rem .65rem;border:1px solid #e5ebf5;border-radius:10px;background:#f8faff;font-size:.84rem;line-height:1.45'>"
            + (lines || "<span style='color:#7d8aa5'>No messages yet.</span>") + "</div>"
            + "<div style='margin-top:.35rem;color:#667085;font-size:.78rem'>Use quick actions to reply or refresh.</div>"
        );
    }

    function findProductMention(text) {
        if (!state.products.length) return null;
        const t = normalize(text);
        let best = null;
        let bestScore = 0;
        state.products.forEach((p) => {
            const name = normalize(p.name);
            const brand = normalize(p.brand || "");
            let score = 0;
            if (name && t.indexOf(name) !== -1) score += 5;
            name.split(/\s+/).forEach((tok) => { if (tok.length > 2 && t.indexOf(tok) !== -1) score += 1; });
            if (brand && t.indexOf(brand) !== -1) score += 1;
            if (score > bestScore) { bestScore = score; best = p; }
        });
        return bestScore >= 2 ? best : null;
    }

    async function ensureData() {
        if (!request) return;
        if (!state.settings) {
            try { state.settings = await request("/settings"); } catch (_) { /* optional */ }
        }
        if (!state.products.length) {
            try {
                const list = await request("/products");
                if (Array.isArray(list)) state.products = list;
            } catch (_) {
                try {
                    const res = await fetch("data/products.json", { cache: "no-store" });
                    if (res.ok) state.products = await res.json();
                } catch (_) { /* ignore */ }
            }
        }
    }

    function scrollToSelector(sel) {
        const el = document.querySelector(sel);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function startCallbackFlow() {
        state.stage = "cb-name";
        state.draft = {};
        appendMessage("bot", "I can arrange a live callback from our team. What’s your <strong>name</strong>?");
        setQuick([{ label: "Cancel", action: "cancel" }]);
    }

    async function handleCallbackFlow(text) {
        const value = String(text || "").trim();
        if (state.stage === "cb-name") {
            if (value.length < 2) { appendMessage("bot", "Please enter your full name (at least 2 characters)."); return; }
            state.draft.name = value;
            state.stage = "cb-phone";
            appendMessage("bot", "Thanks, " + escapeHtml(value) + ". What’s your <strong>phone number</strong>? (e.g. 0912159265)");
            return;
        }
        if (state.stage === "cb-phone") {
            const phone = value.replace(/[^\d+]/g, "");
            if (!/^(\+251|0)9\d{8}$/.test(phone)) {
                appendMessage("bot", "Please enter a valid Ethiopian phone number, e.g. <code>0912159265</code> or <code>+251912159265</code>.");
                return;
            }
            state.draft.phone = phone;
            state.stage = "cb-topic";
            appendMessage("bot", "Got it. What is this about? Choose a topic below or type your own.");
            setQuick([
                { label: "Order or delivery", action: "cb-topic", value: "Order or delivery" },
                { label: "Product or stock", action: "cb-topic", value: "Product or stock question" },
                { label: "Payment or refund", action: "cb-topic", value: "Payment or refund" },
                { label: "Warranty or repair", action: "cb-topic", value: "Warranty or repair" },
                { label: "Something else", action: "cb-topic", value: "Something else" },
                { label: "Cancel", action: "cancel" }
            ]);
            return;
        }
        if (state.stage === "cb-topic") {
            if (value.length < 2) { appendMessage("bot", "Please tell me what the call is about."); return; }
            state.draft.topic = value.slice(0, 80);
            state.stage = "cb-time";
            appendMessage("bot", "When is the best time to call you?");
            setQuick([
                { label: "As soon as possible", action: "cb-time", value: "As soon as possible" },
                { label: "Morning", action: "cb-time", value: "Morning (8:30–12:00)" },
                { label: "Afternoon", action: "cb-time", value: "Afternoon (12:00–17:00)" },
                { label: "Evening", action: "cb-time", value: "Evening (17:00–20:00)" }
            ]);
            return;
        }
        if (state.stage === "cb-time") {
            state.draft.preferredTime = value.slice(0, 60) || "As soon as possible";
            state.stage = "cb-note";
            appendMessage("bot", "Any note for our team? (order reference, model name, etc.) Type your note, or tap <strong>Skip</strong>.");
            setQuick([{ label: "Skip", action: "cb-skip" }, { label: "Cancel", action: "cancel" }]);
            return;
        }
        if (state.stage === "cb-note") {
            state.draft.note = value.slice(0, 500);
            await submitCallback();
        }
    }

    async function submitCallback() {
        if (!request) {
            appendMessage("bot", "I can’t reach the server right now. Please use the <a href=\"call-center.html#callback\">call center page</a> or call us directly.");
            state.stage = "idle";
            setQuick(defaultQuick());
            return;
        }
        state.busy = true;
        typing(true);
        try {
            const created = await request("/callbacks", {
                method: "POST",
                body: JSON.stringify(state.draft)
            });
            typing(false);
            appendMessage("bot",
                "✅ Callback requested successfully. Your reference is <strong>" + escapeHtml(created.reference || "CB-REQUEST") + "</strong>. " +
                "Our team will call <strong>" + escapeHtml(created.phone || state.draft.phone || "your number") + "</strong> during shop hours."
            );
        } catch (err) {
            typing(false);
            const fields = err && err.data && err.data.fields;
            const msg = fields ? Object.values(fields)[0] : (err && err.message) || "Could not submit callback request.";
            appendMessage("bot", "I couldn’t submit that request: " + escapeHtml(msg) + " You can try again or use the <a href=\"call-center.html#callback\">call center page</a>.");
        } finally {
            state.busy = false;
            state.stage = "idle";
            state.draft = {};
            setQuick(defaultQuick());
        }
    }

    function dmQuick(thread) {
        const q = [];
        if (thread && thread.status !== "CLOSED") q.push({ label: "Reply to admin", action: "dm-reply" });
        q.push({ label: "Refresh DM", action: "dm-open" });
        q.push({ label: "Start new DM", action: "dm-start" });
        q.push({ label: "Back", action: "cancel" });
        return q;
    }

    function startDmFlow(fresh) {
        if (!request) {
            appendMessage("bot", "Direct messages need the server connection. Please try again when the backend is available.");
            setQuick(defaultQuick());
            return;
        }
        const saved = getSavedDm();
        state.draft = {};
        if (!fresh && saved.name) state.draft.name = saved.name;
        if (!fresh && saved.phone) state.draft.phone = saved.phone;
        state.stage = state.draft.name ? "dm-phone" : "dm-name";
        if (state.stage === "dm-name") {
            appendMessage("bot", "Start a <strong>direct message to admin</strong>. What’s your <strong>name</strong>?");
        } else {
            appendMessage("bot", "Starting a direct message as <strong>" + escapeHtml(state.draft.name) + "</strong>. What’s your <strong>phone number</strong>? (e.g. 0912159265)");
        }
        setQuick([{ label: "Cancel", action: "cancel" }]);
    }

    async function openDmThread() {
        if (!request) { appendMessage("bot", "I can’t reach the server right now."); return; }
        const saved = getSavedDm();
        if (!saved.threadCode || !saved.phone) {
            appendMessage("bot", "I don’t have a saved conversation yet. Let’s start a new direct message.");
            startDmFlow(true);
            return;
        }
        state.busy = true;
        typing(true);
        try {
            const thread = await request("/messages/" + encodeURIComponent(saved.threadCode) + "?phone=" + encodeURIComponent(saved.phone));
            typing(false);
            renderDmThread(thread);
            setQuick(dmQuick(thread));
        } catch (err) {
            typing(false);
            appendMessage("bot", "I couldn’t open your saved conversation: " + escapeHtml((err && err.message) || "Not found") + ". You can start a new message.");
            setQuick([{ label: "Start new DM", action: "dm-start" }].concat(defaultQuick()));
        } finally {
            state.busy = false;
        }
    }

    async function submitDmStart() {
        state.busy = true;
        typing(true);
        try {
            const created = await request("/messages", {
                method: "POST",
                body: JSON.stringify({
                    name: state.draft.name,
                    phone: state.draft.phone,
                    subject: state.draft.subject || "",
                    message: state.draft.message
                })
            });
            typing(false);
            appendMessage("bot", "✅ Message sent to admin. Your conversation code is <strong>" + escapeHtml(created.threadCode) + "</strong>. Keep this code to continue the chat later.");
            renderDmThread(created);
            state.stage = "idle";
            state.draft = {};
            setQuick(dmQuick(created));
        } catch (err) {
            typing(false);
            const fields = err && err.data && err.data.fields;
            const msg = fields ? Object.values(fields)[0] : (err && err.message) || "Could not send message.";
            appendMessage("bot", "I couldn’t send that message: " + escapeHtml(msg));
            state.stage = "idle";
            state.draft = {};
            setQuick(defaultQuick());
        } finally {
            state.busy = false;
        }
    }

    async function submitDmReply(text) {
        const saved = getSavedDm();
        if (!saved.threadCode || !saved.phone) {
            appendMessage("bot", "No active conversation found. Start a new DM first.");
            state.stage = "idle";
            setQuick(defaultQuick());
            return;
        }
        state.busy = true;
        typing(true);
        try {
            const thread = await request("/messages/" + encodeURIComponent(saved.threadCode) + "/reply?phone=" + encodeURIComponent(saved.phone), {
                method: "POST",
                body: JSON.stringify({ message: text })
            });
            typing(false);
            appendMessage("bot", "Reply sent.");
            renderDmThread(thread);
            state.stage = "idle";
            setQuick(dmQuick(thread));
        } catch (err) {
            typing(false);
            appendMessage("bot", "Could not send reply: " + escapeHtml((err && err.message) || "Request failed"));
            state.stage = "idle";
            setQuick(dmQuick(state.dmThread));
        } finally {
            state.busy = false;
        }
    }

    async function handleDmFlow(text) {
        const value = String(text || "").trim();
        if (state.stage === "dm-name") {
            if (value.length < 2) { appendMessage("bot", "Please enter your name (at least 2 characters)."); return; }
            state.draft.name = value;
            state.stage = "dm-phone";
            appendMessage("bot", "Thanks, " + escapeHtml(value) + ". What’s your <strong>phone number</strong>? (e.g. 0912159265)");
            return;
        }
        if (state.stage === "dm-phone") {
            const phone = value.replace(/[^\d+]/g, "");
            if (!/^(\+251|0)?9?\d{8,12}$/.test(phone) && phone.length < 9) {
                appendMessage("bot", "Please enter a valid phone number (e.g. <code>0912159265</code>).");
                return;
            }
            state.draft.phone = phone;
            state.stage = "dm-subject";
            appendMessage("bot", "Optional: add a short <strong>subject</strong> for admin, or tap Skip.");
            setQuick([{ label: "Skip subject", action: "dm-skip-subject" }, { label: "Cancel", action: "cancel" }]);
            return;
        }
        if (state.stage === "dm-subject") {
            state.draft.subject = value.slice(0, 120);
            state.stage = "dm-message";
            appendMessage("bot", "Please type your <strong>message for admin</strong>.");
            setQuick([{ label: "Cancel", action: "cancel" }]);
            return;
        }
        if (state.stage === "dm-message") {
            if (!value) { appendMessage("bot", "Please enter a message."); return; }
            state.draft.message = value.slice(0, 1000);
            await submitDmStart();
            return;
        }
        if (state.stage === "dm-reply") {
            if (!value) { appendMessage("bot", "Please enter your reply."); return; }
            await submitDmReply(value.slice(0, 1000));
        }
    }

    function setAgentFlow() {
        state.stage = "set-agent";
        appendMessage("bot", "Please type the <strong>assistant name</strong> you want shown in this live support bar (for this device).");
        setQuick([{ label: "Cancel", action: "cancel" }]);
    }

    async function handleAction(action, value) {
        if (state.busy) return;
        switch (action) {
            case "track": {
                appendMessage("user", "Track my order");
                appendMessage("bot", "Opening order tracking… Share your reference code like <code>EVA-XXXXXX</code> if prompted.");
                if (typeof window.openTrack === "function") window.openTrack(value || "");
                else {
                    const modal = $("#trackModal");
                    if (modal) { modal.hidden = false; modal.classList.add("is-open"); }
                }
                break;
            }
            case "contact":
                appendMessage("user", "Contact details");
                scrollToSelector("#contact");
                appendMessage("bot", "I’ve scrolled to the contact section with our address, phone numbers, and map link.");
                break;
            case "products":
                appendMessage("user", value === "ACCESSORY" ? "Browse accessories" : value === "SMARTPHONE" ? "Browse smartphones" : "Browse products");
                scrollToSelector("#products");
                appendMessage("bot", "Here are our products. You can filter by smartphones or accessories on this page.");
                break;
            case "home":
                appendMessage("user", "Go to top");
                window.scrollTo({ top: 0, behavior: "smooth" });
                appendMessage("bot", "Back to the top of the page.");
                break;
            case "callcenter":
                appendMessage("user", "Open call center");
                appendMessage("bot", "Opening the call center page…");
                window.location.href = "call-center.html";
                break;
            case "callback":
                appendMessage("user", "Request callback");
                startCallbackFlow();
                return;
            case "cb-topic":
                appendMessage("user", value || "Topic");
                await handleCallbackFlow(value || "");
                return;
            case "cb-time":
                appendMessage("user", value || "Preferred time");
                await handleCallbackFlow(value || "");
                return;
            case "cb-skip":
                appendMessage("user", "Skip");
                state.draft.note = "";
                await submitCallback();
                return;
            case "dm-start":
                appendMessage("user", "Message admin (DM)");
                startDmFlow(true);
                return;
            case "dm-open":
                appendMessage("user", "Open my DM");
                await openDmThread();
                return;
            case "dm-reply": {
                const saved = getSavedDm();
                if (!saved.threadCode || !saved.phone) {
                    appendMessage("bot", "No active conversation found. Start a new DM first.");
                    return;
                }
                appendMessage("user", "Reply to admin");
                state.stage = "dm-reply";
                appendMessage("bot", "Type your reply to admin for conversation <strong>" + escapeHtml(saved.threadCode) + "</strong>.");
                setQuick([{ label: "Cancel", action: "cancel" }]);
                return;
            }
            case "dm-skip-subject":
                appendMessage("user", "Skip subject");
                state.draft.subject = "";
                state.stage = "dm-message";
                appendMessage("bot", "Please type your <strong>message for admin</strong>.");
                setQuick([{ label: "Cancel", action: "cancel" }]);
                return;
            case "set-agent":
                appendMessage("user", "Set assistant name");
                setAgentFlow();
                return;
            case "clear-agent":
                setAgentName("");
                appendMessage("user", "Clear assistant name");
                appendMessage("bot", "Assistant display name cleared for this device.");
                updateHeader();
                setQuick(defaultQuick());
                return;
            case "ask":
                await handleUserText(value || "");
                return;
            case "cancel":
                appendMessage("user", "Cancel");
                state.stage = "idle";
                state.draft = {};
                appendMessage("bot", "No problem — cancelled. How else can I help?");
                setQuick(state.dmThread ? dmQuick(state.dmThread) : defaultQuick());
                return;
            default:
                break;
        }
        if (state.stage === "idle") setQuick(defaultQuick());
    }

    async function handleUserText(text) {
        const raw = String(text || "").trim();
        if (!raw) return;
        appendMessage("user", escapeHtml(raw), raw);

        if (state.stage && state.stage !== "idle") {
            if (state.stage === "set-agent") {
                const name = raw.replace(/[<>]/g, "").trim().slice(0, 40);
                if (name.length < 2) {
                    appendMessage("bot", "Please enter a name with at least 2 characters.");
                    return;
                }
                setAgentName(name);
                state.stage = "idle";
                appendMessage("bot", "Done. This live support bar will now show assistant name: <strong>" + escapeHtml(name) + "</strong> on this device.");
                updateHeader();
                setQuick(defaultQuick());
                return;
            }
            if (state.stage.indexOf("dm-") === 0) {
                await handleDmFlow(raw);
                return;
            }
            await handleCallbackFlow(raw);
            return;
        }

        await ensureData();
        typing(true);
        window.setTimeout(() => {
            typing(false);
            const answer = answerFor(raw);
            appendMessage("bot", answer.html);
            if (typeof answer.run === "function") {
                try { answer.run(); } catch (_) { /* ignore */ }
            }
            setQuick(answer.quick || defaultQuick());
        }, 280);
    }

    function updateHeader() {
        const head = $("#assistantPanel .assistant-head div");
        if (!head) return;
        const name = agentName();
        head.innerHTML = "<strong>EVA SMART PHONE Live Assistant</strong><span>" + escapeHtml(name ? ("Online • " + name) : "Online • customer support bar") + "</span>";
    }

    function openAssistant() {
        const panel = $("#assistantPanel");
        const toggle = $("#assistantToggle");
        if (!panel || !toggle) return;
        panel.hidden = false;
        toggle.setAttribute("aria-expanded", "true");
        state.open = true;
        const input = $("#assistantInput");
        if (input) input.focus();
        if (!panel.dataset.booted) {
            panel.dataset.booted = "1";
            updateHeader();
            appendMessage("bot", "Hi! I’m the <strong>EVA SMART PHONE live customer support bar</strong>. Ask me about products, delivery, payments, shop hours, request a callback, or send a direct message to admin.");
            setQuick(defaultQuick());
            ensureData();
        }
    }

    function closeAssistant() {
        const panel = $("#assistantPanel");
        const toggle = $("#assistantToggle");
        if (!panel || !toggle) return;
        panel.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        state.open = false;
    }

    function bind() {
        const toggle = $("#assistantToggle");
        const close = $("#assistantClose");
        const form = $("#assistantForm");
        const quick = $("#assistantQuick");
        if (!toggle || !$("#assistantPanel")) return;

        toggle.addEventListener("click", () => { state.open ? closeAssistant() : openAssistant(); });
        if (close) close.addEventListener("click", closeAssistant);

        if (form) {
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                const input = $("#assistantInput");
                if (!input) return;
                const text = input.value;
                input.value = "";
                handleUserText(text);
            });
        }

        if (quick) {
            quick.addEventListener("click", (e) => {
                const btn = e.target.closest("[data-action]");
                if (!btn) return;
                handleAction(btn.getAttribute("data-action"), btn.getAttribute("data-value") || "");
            });
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && state.open) closeAssistant();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bind);
    } else {
        bind();
    }
})();