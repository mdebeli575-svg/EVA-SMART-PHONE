/* Eva Mobile storefront logic: catalogue, cart, checkout, tracking. */
(function () {
    "use strict";

    const { request, formatBirr, escapeHtml, sortProducts, productVisual, statusLabel, methodLabel } = window.EVA;
    const CART_KEY = "eva.cart.v1";
    const MAX_PER_PRODUCT = 10;

    const state = {
        products: [],
        filter: "ALL",
        query: "",
        cart: [],
        catalogueOnline: true
    };

    const $ = (selector, root) => (root || document).querySelector(selector);
    const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

    /* ------------------------------------------------------------------ cart */

    function loadCart() {
        try {
            const raw = localStorage.getItem(CART_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return [];
            return parsed
                .filter((item) => item && item.id && Number(item.quantity) > 0)
                .map((item) => ({
                    id: Number(item.id),
                    name: String(item.name || ""),
                    brand: String(item.brand || ""),
                    category: item.category === "ACCESSORY" ? "ACCESSORY" : "SMARTPHONE",
                    price: Number(item.price) || 0,
                    color: item.color || "#2f6fed",
                    stock: Number(item.stock) || 0,
                    quantity: Math.min(Number(item.quantity), MAX_PER_PRODUCT)
                }));
        } catch (_) {
            return [];
        }
    }

    function saveCart() {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
        } catch (_) { /* private mode */ }
    }

    function cartCount() {
        return state.cart.reduce((sum, item) => sum + item.quantity, 0);
    }

    function cartSubtotal() {
        return state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }

    function productById(id) {
        return state.products.find((p) => p.id === Number(id));
    }

    /* -------------------------------------------------------------- products */

    async function loadProducts() {
        try {
            const live = await request("/products");
            state.products = sortProducts(Array.isArray(live) ? live : []);
            state.catalogueOnline = true;
        } catch (error) {
            state.catalogueOnline = false;
            try {
                const response = await fetch("data/products.json", { cache: "no-store" });
                if (!response.ok) throw new Error("offline catalogue missing");
                state.products = sortProducts(await response.json());
            } catch (_) {
                state.products = [];
            }
            toast("Live catalogue unreachable — showing the offline list. Checkout needs the API on port 8080.", "error");
        }

        // Keep the cart in sync with live stock and prices.
        state.cart = state.cart
            .map((item) => {
                const product = productById(item.id);
                if (!product) return item;
                return Object.assign({}, item, {
                    name: product.name,
                    brand: product.brand,
                    category: product.category,
                    price: product.price,
                    color: product.color || item.color,
                    stock: product.stock,
                    quantity: Math.max(1, Math.min(item.quantity, product.stock || item.quantity, MAX_PER_PRODUCT))
                });
            })
            .filter((item) => item.quantity > 0);
        saveCart();

        renderProducts();
        renderCart();
    }

    function matchesFilters(product) {
        if (state.filter !== "ALL" && product.category !== state.filter) return false;
        if (!state.query) return true;
        const haystack = (product.name + " " + product.brand + " " + (product.description || "")).toLowerCase();
        return haystack.includes(state.query.toLowerCase());
    }

    function stockInfo(product) {
        if (product.stock <= 0) {
            return { badge: "Out of stock", badgeClass: "is-out", text: "Out of stock — call 0912 159 265", textClass: "is-out" };
        }
        if (product.stock <= 3) {
            return { badge: "Only " + product.stock + " left", badgeClass: "", text: "Only " + product.stock + " left at Megenagna", textClass: "is-low" };
        }
        return { badge: "", badgeClass: "", text: "In stock · ready to deliver", textClass: "" };
    }

    function productCard(product) {
        const stock = stockInfo(product);
        const badge = stock.badge
            ? '<span class="product-badge ' + (product.featured && product.stock > 0 ? "is-hot" : "") + ' ' + stock.badgeClass + '">' + escapeHtml(stock.badge) + "</span>"
            : (product.featured ? '<span class="product-badge is-hot">Popular</span>' : "");
        const disabled = product.stock <= 0 ? " disabled" : "";

        return '<article class="product-card" style="--tint:' + escapeHtml(product.color || "#2f6fed") + '">'
            + '<div class="product-art">' + badge + productVisual(product) + "</div>"
            + '<div class="product-info">'
            + '<span class="product-brand">' + escapeHtml(product.brand) + "</span>"
            + '<h3 class="product-name">' + escapeHtml(product.name) + "</h3>"
            + '<div class="product-price-row"><span class="product-price">' + formatBirr(product.price) + "</span></div>"
            + '<p class="product-stock ' + stock.textClass + '">' + escapeHtml(stock.text) + "</p>"
            + '<button class="add-btn" type="button" data-add="' + product.id + '"' + disabled + '>'
            + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/></svg>'
            + (product.stock <= 0 ? "Out of stock" : "Add to cart")
            + "</button></div></article>";
    }

    function renderProducts() {
        const grid = $("#productGrid");
        const count = $("#resultCount");
        if (!grid) return;

        if (!state.products.length) {
            grid.innerHTML = '<div class="loading-note">'
                + "<p><strong>We couldn't load the catalogue.</strong></p>"
                + "<p>The shop page works offline, but checkout needs the Eva Mobile API running on port 8080.</p>"
                + '<button class="btn btn-primary" type="button" data-retry>Try again</button>'
                + "</div>";
            if (count) count.textContent = "";
            return;
        }

        const visible = state.products.filter(matchesFilters);
        if (count) {
            count.textContent = visible.length === state.products.length
                ? visible.length + " products"
                : "Showing " + visible.length + " of " + state.products.length;
        }

        if (!visible.length) {
            grid.innerHTML = '<div class="loading-note"><p><strong>No products match that search.</strong></p>'
                + "<p>Try a different name or clear the filters.</p></div>";
            return;
        }

        grid.innerHTML = visible.map(productCard).join("");
    }

    function setFilter(filter) {
        state.filter = filter === "SMARTPHONE" || filter === "ACCESSORY" ? filter : "ALL";
        $$("[data-filter]").forEach((btn) => {
            btn.classList.toggle("is-active", btn.getAttribute("data-filter") === state.filter);
        });
        renderProducts();
    }

    /* ------------------------------------------------------------------ cart */

    function addToCart(id, silent) {
        const product = productById(id);
        if (!product) {
            toast("That product is no longer available.", "error");
            return false;
        }
        if (product.stock <= 0) {
            toast(product.name + " is out of stock.", "error");
            return false;
        }
        const limit = Math.min(MAX_PER_PRODUCT, product.stock);
        const existing = state.cart.find((item) => item.id === product.id);
        if (existing) {
            if (existing.quantity >= limit) {
                toast("You already have the maximum available quantity in the cart.", "error");
                return false;
            }
            existing.quantity += 1;
            existing.stock = product.stock;
            existing.price = product.price;
        } else {
            state.cart.push({
                id: product.id,
                name: product.name,
                brand: product.brand,
                category: product.category,
                price: product.price,
                color: product.color,
                stock: product.stock,
                quantity: 1
            });
        }
        saveCart();
        renderCart();
        if (!silent) toast(product.name + " added to cart.", "success");
        return true;
    }

    function changeQuantity(id, delta) {
        const item = state.cart.find((entry) => entry.id === id);
        if (!item) return;
        const limit = Math.min(MAX_PER_PRODUCT, item.stock || MAX_PER_PRODUCT);
        const next = item.quantity + delta;
        if (next < 1) {
            removeFromCart(id);
            return;
        }
        if (next > limit) {
            toast("Only " + limit + " available in the shop.", "error");
            return;
        }
        item.quantity = next;
        saveCart();
        renderCart();
    }

    function removeFromCart(id) {
        state.cart = state.cart.filter((item) => item.id !== Number(id));
        saveCart();
        renderCart();
    }

    function renderCart() {
        const body = $("#cartBody");
        const foot = $("#cartFoot");
        const badge = $("#cartBadge");
        if (!body) return;

        const count = cartCount();
        if (badge) {
            badge.textContent = String(count);
            badge.dataset.empty = count === 0 ? "true" : "false";
        }
        $$("[data-open-cart]").forEach((el) => {
            el.setAttribute("aria-label", "Open cart, " + count + " item" + (count === 1 ? "" : "s"));
        });

        if (!state.cart.length) {
            body.innerHTML = '<div class="cart-empty">'
                + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h-2a1 1 0 0 0 0 2h1.2l2 9.2A2 2 0 0 0 10.2 17h8.4a1 1 0 0 0 0-2h-8.2l-.2-1h8.4a2 2 0 0 0 2-1.6L21.4 6H8.3l-.4-1.6A1 1 0 0 0 7 4Zm3 15.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/></svg>'
                + "<strong>Your cart is empty</strong>"
                + "<span>Add a phone or accessory to get started.</span>"
                + '<div style="margin-top:1rem"><button class="btn btn-primary" type="button" data-browse>Browse products</button></div>'
                + "</div>";
            if (foot) foot.hidden = true;
            return;
        }

        body.innerHTML = state.cart.map((item) => {
            const line = item.price * item.quantity;
            return '<div class="cart-item" style="--tint:' + escapeHtml(item.color) + '">'
                + '<div class="cart-item-art">' + productVisual(item) + "</div>"
                + '<div class="cart-item-info"><strong>' + escapeHtml(item.name) + "</strong>"
                + "<span>" + formatBirr(item.price) + " each</span>"
                + '<div class="qty-control">'
                + '<button class="qty-btn" type="button" data-qty="' + item.id + '" data-delta="-1" aria-label="Decrease quantity">−</button>'
                + '<span class="qty-value">' + item.quantity + "</span>"
                + '<button class="qty-btn" type="button" data-qty="' + item.id + '" data-delta="1" aria-label="Increase quantity">+</button>'
                + "</div></div>"
                + '<div class="cart-item-side"><strong>' + formatBirr(line) + "</strong>"
                + '<button class="remove-btn" type="button" data-remove="' + item.id + '">Remove</button></div>'
                + "</div>";
        }).join("");

        if (foot) {
            foot.hidden = false;
            const subtotal = $("#cartSubtotal");
            if (subtotal) subtotal.textContent = formatBirr(cartSubtotal());
        }
    }

    /* --------------------------------------------------------------- drawer */

    let scrollLocked = false;

    function lockScroll() {
        if (!scrollLocked) {
            document.body.classList.add("no-scroll");
            scrollLocked = true;
        }
    }

    function unlockScroll() {
        if (scrollLocked && !$(".modal.is-open")) {
            document.body.classList.remove("no-scroll");
            scrollLocked = false;
        }
    }

    function openCart() {
        const drawer = $("#cartDrawer");
        const overlay = $("#drawerOverlay");
        if (!drawer || !overlay) return;
        overlay.hidden = false;
        requestAnimationFrame(() => {
            drawer.classList.add("is-open");
            overlay.classList.add("is-visible");
        });
        drawer.setAttribute("aria-hidden", "false");
        lockScroll();
    }

    function closeCart() {
        const drawer = $("#cartDrawer");
        const overlay = $("#drawerOverlay");
        if (!drawer || !overlay || !drawer.classList.contains("is-open")) return;
        drawer.classList.remove("is-open");
        overlay.classList.remove("is-visible");
        drawer.setAttribute("aria-hidden", "true");
        window.setTimeout(() => {
            if (!drawer.classList.contains("is-open")) overlay.hidden = true;
        }, 320);
        unlockScroll();
    }

    /* --------------------------------------------------------------- modals */

    function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.hidden = false;
        requestAnimationFrame(() => modal.classList.add("is-open"));
        lockScroll();
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (!modal || modal.hidden) return;
        modal.classList.remove("is-open");
        window.setTimeout(() => {
            if (!modal.classList.contains("is-open")) modal.hidden = true;
            unlockScroll();
        }, 220);
        unlockScroll();
    }

    /* ------------------------------------------------------------- checkout */

    function openCheckout() {
        if (!state.cart.length) {
            toast("Add something to the cart first.", "error");
            return;
        }
        const summary = $("#summaryItems");
        if (summary) {
            summary.innerHTML = state.cart.map((item) =>
                '<li class="summary-item"><span>' + escapeHtml(item.name)
                + " <small>× " + item.quantity + "</small></span><span>"
                + formatBirr(item.price * item.quantity) + "</span></li>"
            ).join("");
        }
        const subtotal = $("#summarySubtotal");
        const total = $("#summaryTotal");
        if (subtotal) subtotal.textContent = formatBirr(cartSubtotal());
        if (total) total.textContent = formatBirr(cartSubtotal());

        const alert = $("#checkoutError");
        if (alert) {
            alert.hidden = true;
            alert.textContent = "";
        }
        $$(".field", $("#checkoutForm")).forEach((field) => {
            field.classList.remove("has-error");
            const error = $(".field-error", field);
            if (error) error.textContent = "";
        });

        closeCart();
        window.setTimeout(() => openModal("checkoutModal"), 220);
    }

    function validateCheckout(data) {
        const errors = {};
        if (!data.customerName || data.customerName.trim().length < 2) {
            errors.customerName = "Please enter your full name.";
        }
        const phone = (data.customerPhone || "").replace(/[\s-]/g, "");
        if (!/^(\+251|0)9\d{8}$/.test(phone)) {
            errors.customerPhone = "Enter a valid Ethiopian number, e.g. 0912159265.";
        }
        if (!data.deliveryAddress || data.deliveryAddress.trim().length < 5) {
            errors.deliveryAddress = "Please add a delivery address with a landmark.";
        }
        return errors;
    }

    function showFieldErrors(errors) {
        Object.keys(errors).forEach((name) => {
            const input = $('[name="' + name + '"]', $("#checkoutForm"));
            const holder = input ? input.closest(".field") : null;
            if (holder) {
                holder.classList.add("has-error");
                const slot = $('.field-error[data-error-for="' + name + '"]', holder);
                if (slot) slot.textContent = errors[name];
            }
        });
    }

    async function submitCheckout(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const button = $("#placeOrderButton");
        const alert = $("#checkoutError");
        const data = Object.fromEntries(new FormData(form).entries());

        $$(".field", form).forEach((field) => {
            field.classList.remove("has-error");
            const error = $(".field-error", field);
            if (error) error.textContent = "";
        });
        if (alert) alert.hidden = true;

        const errors = validateCheckout(data);
        if (Object.keys(errors).length) {
            showFieldErrors(errors);
            if (alert) {
                alert.textContent = Object.values(errors)[0];
                alert.hidden = false;
            }
            return;
        }

        const payload = {
            customerName: data.customerName.trim(),
            customerPhone: (data.customerPhone || "").replace(/[\s-]/g, ""),
            deliveryAddress: data.deliveryAddress.trim(),
            note: (data.note || "").trim() || null,
            paymentMethod: data.paymentMethod,
            items: state.cart.map((item) => ({ productId: item.id, quantity: item.quantity }))
        };

        if (button) {
            button.disabled = true;
            button.textContent = "Placing order…";
        }

        try {
            const order = await request("/orders/checkout", {
                method: "POST",
                body: JSON.stringify(payload)
            });

            // Keep a copy so a cancelled payment can put the items back in the cart.
            try {
                sessionStorage.setItem("eva.cartBackup", JSON.stringify(state.cart));
            } catch (_) { /* ignore */ }

            state.cart = [];
            saveCart();
            renderCart();
            closeModal("checkoutModal");
            form.reset();

            if (order && order.paymentUrl) {
                location.assign(resolvePaymentUrl(order.paymentUrl));
            } else {
                toast("Order " + order.reference + " created.", "success");
                window.setTimeout(() => openTrack(order.reference), 400);
            }
        } catch (error) {
            if (error.data && error.data.fields) showFieldErrors(error.data.fields);
            if (alert) {
                alert.textContent = error.message;
                alert.hidden = false;
            }
            toast(error.message, "error");
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = "Place order";
            }
        }
    }

    function resolvePaymentUrl(url) {
        if (/^https?:\/\//i.test(url)) return url;
        const clean = String(url).replace(/^\/+/, "");
        return location.href.replace(/[^/]*$/, "") + clean;
    }

    /* ------------------------------------------------------------- tracking */

    function openTrack(reference) {
        const input = $("#trackInputModal");
        const result = $("#trackResult");
        if (result) {
            result.hidden = true;
            result.innerHTML = "";
        }
        openModal("trackModal");
        if (reference && input) {
            input.value = reference;
            lookupOrder(reference);
        } else if (input) {
            input.value = "";
            input.focus();
        }
    }

    async function lookupOrder(rawReference) {
        const result = $("#trackResult");
        if (!result) return;
        result.hidden = false;

        const reference = String(rawReference || "").trim().toUpperCase();
        if (!reference) {
            result.innerHTML = '<p class="track-error">Enter the order reference from your confirmation.</p>';
            return;
        }

        result.innerHTML = '<p class="muted">Looking up ' + escapeHtml(reference) + "…</p>";
        try {
            const order = await request("/orders/" + encodeURIComponent(reference));
            renderTrackResult(order);
        } catch (error) {
            const message = error.status === 404
                ? "No order found with reference " + escapeHtml(reference) + "."
                : escapeHtml(error.message);
            result.innerHTML = '<p class="track-error">' + message + "</p>";
        }
    }

    function renderTrackResult(order) {
        const result = $("#trackResult");
        if (!result) return;
        const status = order.status;
        const stage = status === "DELIVERED" ? 3 : status === "PAID" ? 2 : status === "PENDING_PAYMENT" ? 1 : 0;
        const steps = ["Order placed", "Payment confirmed", "Delivered"];
        const items = (order.items || []).map((item) =>
            '<li><span>' + escapeHtml(item.productName) + " × " + item.quantity + "</span><span>"
            + formatBirr(item.lineTotal) + "</span></li>"
        ).join("");

        result.innerHTML = '<div class="track-head"><strong>' + escapeHtml(order.reference) + "</strong>"
            + '<span class="status-chip status-' + escapeHtml(status) + '">' + escapeHtml(statusLabel(status)) + "</span></div>"
            + (stage > 0
                ? '<div class="timeline">' + steps.map((label, index) =>
                    '<div class="timeline-step' + (index < stage ? " is-done" : "") + '">' + escapeHtml(label) + "</div>"
                ).join("") + "</div>"
                : '<p class="track-error">' + escapeHtml(order.failureReason || "This order is no longer active.") + "</p>")
            + '<ul class="track-items">' + items + "</ul>"
            + '<div class="track-meta"><span>Total</span><strong>' + formatBirr(order.totalAmount) + "</strong></div>"
            + '<div class="track-meta"><span>Payment</span><span>' + escapeHtml(methodLabel(order.paymentMethod)) + "</span></div>"
            + '<div class="track-meta"><span>Delivery to</span><span style="text-align:right;max-width:60%">' + escapeHtml(order.deliveryAddress) + "</span></div>";
    }

    /* ---------------------------------------------------------------- toast */

    function toast(message, kind) {
        const stack = $("#toastStack");
        if (!stack) return;
        const el = document.createElement("div");
        el.className = "toast" + (kind ? " is-" + kind : "");
        el.setAttribute("role", "status");
        el.innerHTML = (kind === "error"
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 1 21h22L12 2Zm1 15h-2v-2h2v2Zm0-4h-2V8h2v5Z"/></svg>'
            : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.6 16.2-4-4L4.2 13.6 9.6 19 20 8.6 18.6 7.2 9.6 16.2Z"/></svg>')
            + "<span>" + escapeHtml(message) + "</span>";
        stack.appendChild(el);
        window.setTimeout(() => {
            el.classList.add("is-leaving");
            window.setTimeout(() => el.remove(), 280);
        }, 3600);
    }

    /* --------------------------------------------------------------- events */

    function bindEvents() {
        const cartButton = $("#cartButton");
        if (cartButton) cartButton.addEventListener("click", openCart);
        const closeButton = $("#closeCart");
        if (closeButton) closeButton.addEventListener("click", closeCart);
        const overlay = $("#drawerOverlay");
        if (overlay) overlay.addEventListener("click", closeCart);

        const grid = $("#productGrid");
        if (grid) {
            grid.addEventListener("click", (event) => {
                const add = event.target.closest("[data-add]");
                if (add && !add.disabled) {
                    const added = addToCart(add.getAttribute("data-add"));
                    if (added) openCart();
                    return;
                }
                if (event.target.closest("[data-retry]")) loadProducts();
            });
        }

        const cartBody = $("#cartBody");
        if (cartBody) {
            cartBody.addEventListener("click", (event) => {
                const qty = event.target.closest("[data-qty]");
                if (qty) {
                    changeQuantity(Number(qty.getAttribute("data-qty")), Number(qty.getAttribute("data-delta")));
                    return;
                }
                const remove = event.target.closest("[data-remove]");
                if (remove) {
                    removeFromCart(remove.getAttribute("data-remove"));
                    return;
                }
                if (event.target.closest("[data-browse]")) {
                    closeCart();
                    const products = $("#products");
                    if (products) products.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            });
        }

        const checkoutButton = $("#checkoutButton");
        if (checkoutButton) checkoutButton.addEventListener("click", openCheckout);

        const checkoutForm = $("#checkoutForm");
        if (checkoutForm) checkoutForm.addEventListener("submit", submitCheckout);
        $$("[data-close-checkout]").forEach((btn) =>
            btn.addEventListener("click", () => closeModal("checkoutModal")));

        const checkoutModal = $("#checkoutModal");
        if (checkoutModal) {
            checkoutModal.addEventListener("click", (event) => {
                if (event.target === checkoutModal) closeModal("checkoutModal");
            });
        }

        const trackModal = $("#trackModal");
        if (trackModal) {
            trackModal.addEventListener("click", (event) => {
                if (event.target === trackModal) closeModal("trackModal");
            });
        }
        $$("[data-close-track]").forEach((btn) =>
            btn.addEventListener("click", () => closeModal("trackModal")));

        $$("[data-open-track]").forEach((link) => {
            link.addEventListener("click", (event) => {
                event.preventDefault();
                openTrack();
            });
        });

        const trackFormModal = $("#trackFormModal");
        if (trackFormModal) {
            trackFormModal.addEventListener("submit", (event) => {
                event.preventDefault();
                lookupOrder($("#trackInputModal").value);
            });
        }

        const trackFormInline = $("#trackFormInline");
        if (trackFormInline) {
            trackFormInline.addEventListener("submit", (event) => {
                event.preventDefault();
                const value = $("#trackInputInline").value;
                openTrack();
                lookupOrder(value);
            });
        }

        $$("[data-filter]").forEach((button) => {
            button.addEventListener("click", () => setFilter(button.getAttribute("data-filter")));
        });

        $$("[data-category]").forEach((link) => {
            link.addEventListener("click", () => setFilter(link.getAttribute("data-category")));
        });

        const search = $("#productSearch");
        if (search) {
            let timer = null;
            search.addEventListener("input", () => {
                window.clearTimeout(timer);
                timer = window.setTimeout(() => {
                    state.query = search.value.trim();
                    renderProducts();
                }, 140);
            });
        }

        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            if ($("#cartDrawer") && $("#cartDrawer").classList.contains("is-open")) {
                closeCart();
                return;
            }
            if ($("#checkoutModal") && !$("#checkoutModal").hidden) {
                closeModal("checkoutModal");
                return;
            }
            if ($("#trackModal") && !$("#trackModal").hidden) {
                closeModal("trackModal");
            }
        });

        const header = $(".site-header");
        if (header) {
            const onScroll = () => header.classList.toggle("is-stuck", window.scrollY > 8);
            window.addEventListener("scroll", onScroll, { passive: true });
            onScroll();
        }
    }

    /* ------------------------------------------------------------- settings */

    function prettyPhone(raw) {
        const digits = String(raw || "").replace(/[^\d]/g, "");
        if (digits.length === 10 && digits.charAt(0) === "0") {
            return digits.slice(0, 4) + " " + digits.slice(4, 7) + " " + digits.slice(7);
        }
        if (digits.length === 12 && digits.indexOf("251") === 0) {
            return "0" + digits.slice(3, 5) + " " + digits.slice(5, 8) + " " + digits.slice(8);
        }
        return String(raw || "");
    }

    function applySettings(settings) {
        if (!settings) return;

        $$("[data-setting]").forEach((node) => {
            const value = settings[node.getAttribute("data-setting")];
            if (typeof value === "string" && value.trim()) node.textContent = value;
        });

        $$("[data-phone]").forEach((node) => {
            const raw = settings[node.getAttribute("data-phone")];
            const digits = String(raw || "").replace(/[^\d+]/g, "");
            if (!digits) return;
            node.textContent = prettyPhone(raw);
            node.setAttribute("href", "tel:" + digits);
        });

        $$("[data-phone-link]").forEach((node) => {
            const digits = String(settings[node.getAttribute("data-phone-link")] || "").replace(/[^\d+]/g, "");
            if (digits) node.setAttribute("href", "tel:" + digits);
        });

        if (settings.tagline && settings.tagline.trim()) {
            document.title = "Eva Mobile | " + settings.tagline.trim();
        }
    }

    async function loadSettings() {
        try {
            applySettings(await request("/settings"));
        } catch (_) {
            /* Offline: keep the copy already in the HTML. */
        }
    }

    /* ----------------------------------------------------------------- init */

    function init() {
        state.cart = loadCart();
        const year = $("#year");
        if (year) year.textContent = String(new Date().getFullYear());
        bindEvents();
        renderCart();
        loadSettings();
        loadProducts();

        const trackParam = new URLSearchParams(location.search).get("track");
        if (trackParam) {
            window.setTimeout(() => openTrack(trackParam), 350);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
