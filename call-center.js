/* MBO Digital call center: contact wiring, callback form, settings. */
(function () {
    "use strict";

    const { request, mbo } = window.EVA;
    const PHONE_RE = /^(\+251|0)9\d{8}$/;

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => Array.prototype.slice.call(document.querySelectorAll(selector));

    const els = {
        form: $("#callbackForm"),
        formBody: $("#callbackFormBody"),
        success: $("#callbackSuccess"),
        name: $("#cbName"),
        phone: $("#cbPhone"),
        topic: $("#cbTopic"),
        time: $("#cbTime"),
        note: $("#cbNote"),
        error: $("#callbackError"),
        submit: $("#callbackSubmit"),
        ref: $("#callbackRef"),
        successPhone: $("#callbackPhone"),
        again: $("#callbackAgain")
    };

    /* ------------------------------------------------------------- contacts */

    function applyContacts() {
        $$("[data-mbo-phone]").forEach((node) => {
            const phone = mbo.phones[Number(node.getAttribute("data-mbo-phone"))];
            if (!phone) return;
            node.setAttribute("href", "tel:" + phone.tel);
            if (node.tagName === "A" && !node.hasAttribute("data-mbo-phone-text")) {
                node.textContent = phone.display;
            }
        });
        $$("[data-mbo-phone-text]").forEach((node) => {
            const phone = mbo.phones[Number(node.getAttribute("data-mbo-phone-text"))];
            if (phone) node.textContent = phone.display;
        });
        $$("[data-mbo-phone-card]").forEach((node) => {
            const phone = mbo.phones[Number(node.getAttribute("data-mbo-phone-card"))];
            if (phone) node.setAttribute("href", "tel:" + phone.tel);
        });
        $$('[data-mbo="telegram"]').forEach((node) => {
            node.setAttribute("href", mbo.telegram.url);
            node.textContent = mbo.telegram.label;
        });
        $$('[data-mbo="tiktok"]').forEach((node) => {
            node.setAttribute("href", mbo.tiktok.url);
            node.textContent = mbo.tiktok.label;
        });
    }

    async function applySettings() {
        try {
            const settings = await request("/settings");
            $$("[data-setting]").forEach((node) => {
                const value = settings[node.getAttribute("data-setting")];
                if (typeof value === "string" && value.trim()) node.textContent = value;
            });
        } catch (_) {
            /* Offline: keep the static hours already in the page. */
        }
    }

    /* ---------------------------------------------------------------- form */

    function normalizePhone(raw) {
        let digits = String(raw || "").replace(/[^\d+]/g, "");
        if (digits.indexOf("251") === 0) digits = "+" + digits;
        return digits;
    }

    function prettyPhone(raw) {
        const digits = String(raw || "").replace(/[^\d]/g, "");
        if (digits.length === 10 && digits.charAt(0) === "0") {
            return digits.slice(0, 4) + " " + digits.slice(4, 7) + " " + digits.slice(7);
        }
        if (digits.length === 12 && digits.indexOf("251") === 0) {
            return "+251 " + digits.slice(3, 6) + " " + digits.slice(6, 9) + " " + digits.slice(9);
        }
        return String(raw || "");
    }

    function showError(message) {
        els.error.textContent = message;
        els.error.hidden = false;
    }

    function clearError() {
        els.error.hidden = true;
        els.error.textContent = "";
    }

    function resetForm() {
        els.form.reset();
        clearError();
        els.formBody.hidden = false;
        els.success.hidden = true;
        els.submit.disabled = false;
        els.submit.textContent = "Request callback";
        els.name.focus();
    }

    async function submit(event) {
        event.preventDefault();
        clearError();

        const name = els.name.value.trim();
        const phone = normalizePhone(els.phone.value);
        const topic = els.topic.value;
        const preferredTime = els.time.value;
        const note = els.note.value.trim();

        if (name.length < 2) {
            showError("Please enter your name.");
            els.name.focus();
            return;
        }
        if (!PHONE_RE.test(phone)) {
            showError("Enter a valid Ethiopian phone number, e.g. 0912159265.");
            els.phone.focus();
            return;
        }
        if (!topic) {
            showError("Choose what the call is about.");
            els.topic.focus();
            return;
        }

        els.submit.disabled = true;
        els.submit.textContent = "Sending…";
        try {
            const created = await request("/callbacks", {
                method: "POST",
                body: JSON.stringify({ name, phone, topic, preferredTime, note })
            });
            els.ref.textContent = created.reference;
            els.successPhone.textContent = prettyPhone(created.phone);
            els.formBody.hidden = true;
            els.success.hidden = false;
            els.success.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch (error) {
            const fields = error.data && error.data.fields;
            const firstField = fields ? Object.keys(fields).map((key) => fields[key])[0] : null;
            showError(firstField || error.message || "Could not send the request. Please try again.");
        } finally {
            els.submit.disabled = false;
            els.submit.textContent = "Request callback";
        }
    }

    function init() {
        applyContacts();
        applySettings();
        const year = $("#year");
        if (year) year.textContent = String(new Date().getFullYear());
        if (!els.form) return;
        els.form.addEventListener("submit", submit);
        els.again.addEventListener("click", resetForm);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
