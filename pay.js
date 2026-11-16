/* Sandbox payment page. Mirrors the Telebirr / CBE redirect flow without real money. */
(function () {
    "use strict";

    const { request, formatBirr, escapeHtml, statusLabel, methodLabel } = window.EVA;
    const DEMO_PIN = "1234";
    const CART_KEY = "eva.cart.v1";
    const CART_BACKUP_KEY = "eva.cartBackup";

    const params = new URLSearchParams(location.search);
    const reference = (params.get("ref") || "").trim().toUpperCase();

    const card = document.getElementById("payCard");
    let order = null;
    let method = "TELEBIRR";
    let pin = "";
    let busy = false;

    init();

    async function init() {
        if (!reference) {
            renderError("No order reference was provided.", "Please return to the shop and start checkout again.");
            return;
        }
        try {
            order = await request("/orders/" + encodeURIComponent(reference));
        } catch (error) {
            renderError("We could not load order " + reference + ".", error.message);
            return;
        }

        method = order.paymentMethod || (params.get("method") || "TELEBIRR").toUpperCase();

        if (order.status === "PAID" || order.status === "DELIVERED") {
            clearCartBackup();
            renderSuccess(order, true);
            return;
        }
        if (order.status === "FAILED" || order.status === "CANCELLED") {
            restoreCartBackup();
            renderDeclined(order);
            return;
        }
        renderForm();
    }

    function providerHeader(title, subtitle) {
        const isCbe = method === "CBE";
        return '<div class="pay-provider' + (isCbe ? " is-cbe" : "") + '">'
            + "<div><strong>" + escapeHtml(title) + "</strong><span>" + escapeHtml(subtitle) + "</span></div>"
            + '<span class="lock-badge"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 9V7a5 5 0 0 0-10 0v2H5v12h14V9h-2Zm-8 0V7a3 3 0 0 1 6 0v2H9Z"/></svg></span>'
            + "</div>";
    }

    function providerTitle() {
        return method === "CBE" ? "CBE Birr" : "telebirr";
    }

    function maskPhone(phone) {
        const value = String(phone || "");
        if (value.length < 5) return value;
        return value.slice(0, 4) + " ••• " + value.slice(-2);
    }

    function renderForm() {
        card.innerHTML = providerHeader(providerTitle(), "Merchant: EVA MOBILE · Megenagna")
            + '<div class="pay-body">'
            + '<div class="sandbox-banner"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 1 21h22L12 2Zm1 15h-2v-2h2v2Zm0-4h-2V8h2v5Z"/></svg>'
            + "<span>Sandbox mode. This is a demo checkout — no real money moves. Use PIN <strong>" + DEMO_PIN + "</strong>.</span></div>"
            + '<div class="pay-amount-block"><span>Amount to pay</span><strong>' + formatBirr(order.totalAmount) + "</strong>"
            + "<em>Order " + escapeHtml(order.reference) + "</em></div>"
            + '<div class="pay-meta">'
            + "<div><span>Customer</span><strong>" + escapeHtml(order.customerName) + "</strong></div>"
            + "<div><span>Phone</span><strong>" + escapeHtml(maskPhone(order.customerPhone)) + "</strong></div>"
            + "<div><span>Method</span><strong>" + escapeHtml(methodLabel(method)) + "</strong></div>"
            + "</div>"
            + '<label class="pin-label" for="pinPad">Enter your 4-digit ' + escapeHtml(providerTitle()) + " PIN</label>"
            + '<div class="pin-dots" id="pinDots" aria-hidden="true"><i></i><i></i><i></i><i></i></div>'
            + '<div class="pin-pad" id="pinPad" role="group" aria-label="PIN keypad">'
            + ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) =>
                '<button class="pin-key" type="button" data-key="' + digit + '">' + digit + "</button>").join("")
            + '<button class="pin-key is-soft" type="button" data-key="clear">Clear</button>'
            + '<button class="pin-key" type="button" data-key="0">0</button>'
            + '<button class="pin-key is-soft" type="button" data-key="back">⌫</button>'
            + "</div>"
            + '<p class="pin-hint">Demo PIN: <strong>' + DEMO_PIN + "</strong></p>"
            + '<div class="pay-error" id="payError" hidden></div>'
            + '<button class="btn btn-primary btn-block" type="button" id="payNow">Pay ' + formatBirr(order.totalAmount) + "</button>"
            + '<button class="pay-cancel" type="button" id="cancelPayment">Cancel payment</button>'
            + "</div>";

        const pad = document.getElementById("pinPad");
        pad.addEventListener("click", (event) => {
            const key = event.target.closest("[data-key]");
            if (!key) return;
            handleKey(key.getAttribute("data-key"));
        });

        document.getElementById("payNow").addEventListener("click", submitPin);
        document.getElementById("cancelPayment").addEventListener("click", cancelPayment);
        document.addEventListener("keydown", onKeyDown);
    }

    function onKeyDown(event) {
        if (!document.getElementById("pinPad")) return;
        if (/^\d$/.test(event.key)) {
            event.preventDefault();
            handleKey(event.key);
        } else if (event.key === "Backspace") {
            event.preventDefault();
            handleKey("back");
        } else if (event.key === "Enter") {
            event.preventDefault();
            submitPin();
        }
    }

    function handleKey(key) {
        const error = document.getElementById("payError");
        if (error) error.hidden = true;

        if (key === "clear") {
            pin = "";
        } else if (key === "back") {
            pin = pin.slice(0, -1);
        } else if (/^\d$/.test(key) && pin.length < 4) {
            pin += key;
        }
        const dots = document.querySelectorAll("#pinDots i");
        dots.forEach((dot, index) => dot.classList.toggle("is-filled", index < pin.length));
    }

    function showPinError(message) {
        const box = document.getElementById("payError");
        if (box) {
            box.textContent = message;
            box.hidden = false;
        }
    }

    async function submitPin() {
        if (busy) return;
        if (pin.length !== 4) {
            showPinError("Enter your 4-digit PIN.");
            return;
        }
        if (pin !== DEMO_PIN) {
            showPinError("Incorrect PIN. In sandbox mode the PIN is " + DEMO_PIN + ".");
            pin = "";
            document.querySelectorAll("#pinDots i").forEach((dot) => dot.classList.remove("is-filled"));
            return;
        }
        await confirmPayment("SUCCESS");
    }

    async function cancelPayment() {
        if (busy) return;
        await confirmPayment("FAILED");
    }

    async function confirmPayment(outcome) {
        busy = true;
        const button = document.getElementById("payNow");
        const cancel = document.getElementById("cancelPayment");
        if (button) {
            button.disabled = true;
            button.textContent = "Processing…";
        }
        if (cancel) cancel.disabled = true;

        try {
            const updated = await request("/payments/" + encodeURIComponent(reference) + "/confirm", {
                method: "POST",
                body: JSON.stringify({
                    outcome: outcome,
                    providerTxnId: "SBX-" + Date.now().toString(36).toUpperCase()
                })
            });
            if (updated.status === "PAID") {
                clearCartBackup();
                renderSuccess(updated, false);
            } else {
                restoreCartBackup();
                renderDeclined(updated);
            }
        } catch (error) {
            busy = false;
            if (button) {
                button.disabled = false;
                button.textContent = "Pay " + formatBirr(order.totalAmount);
            }
            if (cancel) cancel.disabled = false;
            showPinError(error.message);
        }
    }

    function renderSuccess(paidOrder, wasAlreadyPaid) {
        card.innerHTML = providerHeader(providerTitle(), "Payment confirmed")
            + '<div class="pay-state is-success">'
            + '<div class="pay-state-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.6 16.2-4-4L4.2 13.6 9.6 19 20 8.6 18.6 7.2 9.6 16.2Z"/></svg></div>'
            + "<h1>" + (wasAlreadyPaid ? "Order already paid" : "Payment successful") + "</h1>"
            + "<p>" + (wasAlreadyPaid
                ? "This order was confirmed earlier. No further payment is needed."
                : "Thank you, " + escapeHtml(String(paidOrder.customerName || "").split(" ")[0]) + ". Eva Mobile will call you to arrange delivery.")
            + "</p>"
            + '<div class="receipt">'
            + "<div><span>Reference</span><strong>" + escapeHtml(paidOrder.reference) + "</strong></div>"
            + "<div><span>Amount</span><strong>" + formatBirr(paidOrder.totalAmount) + "</strong></div>"
            + "<div><span>Method</span><strong>" + escapeHtml(methodLabel(paidOrder.paymentMethod)) + "</strong></div>"
            + "<div><span>Status</span><strong>Paid</strong></div>"
            + "</div>"
            + '<a class="btn btn-primary btn-block" href="index.html?track=' + encodeURIComponent(paidOrder.reference) + '">Track this order</a>'
            + '<p style="margin:.9rem 0 0;font-size:.78rem">Keep your reference to check status any time.</p>'
            + "</div>";
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function renderDeclined(failedOrder) {
        card.innerHTML = providerHeader(providerTitle(), "Payment not completed")
            + '<div class="pay-state is-failed">'
            + '<div class="pay-state-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 12.6 12.6-1.4 1.4L5 6.4 6.4 5Zm12.6 1.4L6.4 19 5 17.6 17.6 5 19 6.4Z"/></svg></div>'
            + "<h1>Payment cancelled</h1>"
            + "<p>" + escapeHtml(failedOrder.failureReason || "The payment was not completed, so no money was taken.")
            + " Your items are back in the cart.</p>"
            + '<div class="receipt">'
            + "<div><span>Reference</span><strong>" + escapeHtml(failedOrder.reference) + "</strong></div>"
            + "<div><span>Amount</span><strong>" + formatBirr(failedOrder.totalAmount) + "</strong></div>"
            + "<div><span>Status</span><strong>" + escapeHtml(statusLabel(failedOrder.status)) + "</strong></div>"
            + "</div>"
            + '<a class="btn btn-primary btn-block" href="index.html">Return to the shop</a>'
            + '<p style="margin:.9rem 0 0;font-size:.78rem">No money was taken. You can try checkout again.</p>'
            + "</div>";
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function renderError(title, detail) {
        card.innerHTML = providerHeader(providerTitle(), "Checkout")
            + '<div class="pay-state is-failed">'
            + '<div class="pay-state-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 1 21h22L12 2Zm1 15h-2v-2h2v2Zm0-4h-2V8h2v5Z"/></svg></div>'
            + "<h1>" + escapeHtml(title) + "</h1>"
            + "<p>" + escapeHtml(detail || "") + "</p>"
            + '<a class="btn btn-primary btn-block" href="index.html" style="margin-top:1rem">Back to the shop</a>'
            + "</div>";
    }

    function restoreCartBackup() {
        try {
            const raw = sessionStorage.getItem(CART_BACKUP_KEY);
            if (!raw) return;
            const cart = JSON.parse(raw);
            if (Array.isArray(cart) && cart.length) {
                localStorage.setItem(CART_KEY, JSON.stringify(cart));
            }
        } catch (_) { /* ignore */ }
    }

    function clearCartBackup() {
        try {
            sessionStorage.removeItem(CART_BACKUP_KEY);
        } catch (_) { /* ignore */ }
    }
})();
