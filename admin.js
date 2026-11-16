/* Eva Mobile staff dashboard: orders, product catalogue and photo uploads. */
(function () {
    "use strict";

    const { request, requestMultipart, formatBirr, escapeHtml, assetUrl, productArt, statusLabel } = window.EVA;
    const KEY_STORAGE = "eva.adminKey";
    const STATUSES = ["PENDING_PAYMENT", "PAID", "DELIVERED", "FAILED", "CANCELLED"];
    const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => Array.prototype.slice.call(document.querySelectorAll(selector));

    const state = {
        key: "",
        view: "orders",
        status: "ALL",
        page: 0,
        size: 25,
        totalPages: 1,
        totalElements: 0,
        loading: false,
        products: [],
        productsLoaded: false,
        productSearch: "",
        settingsLoaded: false,
        settingsSaving: false,
        analysisLoaded: false,
        messagesLoaded: false,
        messagesStatus: "ALL",
        messagesPage: 0,
        messagesSize: 25,
        messagesTotalPages: 1,
        selectedThreadCode: "",
        editing: null,
        existingImage: null,
        pendingFile: null,
        previewObjectUrl: null,
        saving: false
    };

    const els = {};

    function cacheElements() {
        els.gate = $("#gate");
        els.gateForm = $("#gateForm");
        els.gateError = $("#gateError");
        els.gateButton = $("#gateButton");
        els.keyInput = $("#adminKeyInput");
        els.dashboard = $("#dashboard");
        els.logout = $("#logoutButton");

        els.ordersView = $("#ordersView");
        els.productsView = $("#productsView");
        els.analysisView = $("#analysisView");
        els.settingsView = $("#settingsView");

        els.statusFilter = $("#statusFilter");
        els.refresh = $("#refreshButton");
        els.ordersBody = $("#ordersBody");
        els.pagerInfo = $("#pagerInfo");
        els.prev = $("#prevPage");
        els.next = $("#nextPage");
        els.updatedAt = $("#updatedAt");
        els.statTotal = $("#statTotal");
        els.statPending = $("#statPending");
        els.statPaid = $("#statPaid");
        els.statRevenue = $("#statRevenue");

        els.productSearch = $("#productSearch");
        els.refreshProducts = $("#refreshProducts");
        els.addProductButton = $("#addProductButton");
        els.productsBody = $("#productsBody");
        els.productsUpdated = $("#productsUpdated");

        els.refreshAnalysis = $("#refreshAnalysis");
        els.analysisUpdated = $("#analysisUpdated");
        els.anOrdersToday = $("#anOrdersToday");
        els.anConversion = $("#anConversion");
        els.anCallbacksNew = $("#anCallbacksNew");
        els.anRevenue = $("#anRevenue");
        els.analysisStatusBreakdown = $("#analysisStatusBreakdown");
        els.analysisPayments = $("#analysisPayments");
        els.analysisCallbacks = $("#analysisCallbacks");
        els.analysisProducts = $("#analysisProducts");
        els.analysisRecentOrders = $("#analysisRecentOrders");

        els.messagesView = $("#messagesView");
        els.messagesFilter = $("#messagesFilter");
        els.refreshMessages = $("#refreshMessages");
        els.messagesUpdated = $("#messagesUpdated");
        els.messagesThreadsBody = $("#messagesThreadsBody");
        els.messagesPagerInfo = $("#messagesPagerInfo");
        els.messagesPrev = $("#messagesPrev");
        els.messagesNext = $("#messagesNext");
        els.dmThreadTitle = $("#dmThreadTitle");
        els.dmThreadMeta = $("#dmThreadMeta");
        els.dmThreadStatus = $("#dmThreadStatus");
        els.dmThreadInfo = $("#dmThreadInfo");
        els.dmMessagesLog = $("#dmMessagesLog");
        els.dmReplyForm = $("#dmReplyForm");
        els.dmReplyInput = $("#dmReplyInput");
        els.dmReplySend = $("#dmReplySend");
        els.messagesUnreadBadge = $("#messagesUnreadBadge");

        els.settingsForm = $("#settingsForm");
        els.settingsUpdated = $("#settingsUpdated");
        els.settingsReset = $("#settingsReset");
        els.settingsSave = $("#settingsSave");

        els.modal = $("#productModal");
        els.form = $("#productForm");
        els.formError = $("#productFormError");
        els.modalTitle = $("#productModalTitle");
        els.modalEyebrow = $("#productModalEyebrow");
        els.modalClose = $("#productModalClose");
        els.pName = $("#pName");
        els.pBrand = $("#pBrand");
        els.pCategory = $("#pCategory");
        els.pPrice = $("#pPrice");
        els.pStock = $("#pStock");
        els.pColor = $("#pColor");
        els.pDescription = $("#pDescription");
        els.pFeatured = $("#pFeatured");
        els.pActive = $("#pActive");
        els.pImageUrl = $("#pImageUrl");
        els.pImage = $("#pImage");
        els.imagePreview = $("#imagePreview");
        els.chooseImage = $("#chooseImage");
        els.removeImage = $("#removeImage");
        els.productCancel = $("#productCancel");
        els.productSave = $("#productSave");
    }

    function authHeaders() {
        return { "X-Admin-Key": state.key };
    }

    function showGate(message) {
        els.gate.hidden = false;
        els.dashboard.hidden = true;
        els.logout.hidden = true;
        if (message) {
            els.gateError.textContent = message;
            els.gateError.hidden = false;
        }
        window.setTimeout(() => els.keyInput.focus(), 50);
    }

    function showDashboard() {
        els.gate.hidden = true;
        els.dashboard.hidden = false;
        els.logout.hidden = false;
        els.gateError.hidden = true;
    }

    function handleAuthError() {
        try { sessionStorage.removeItem(KEY_STORAGE); } catch (_) { /* ignore */ }
        state.key = "";
        showGate("Your admin key was rejected. Please sign in again.");
    }

    async function signIn(key) {
        const candidate = (key || "").trim();
        if (!candidate) {
            showGate("Enter the admin key.");
            return;
        }
        els.gateButton.disabled = true;
        els.gateButton.textContent = "Checking…";
        try {
            const stats = await request("/admin/stats", { headers: { "X-Admin-Key": candidate } });
            state.key = candidate;
            try { sessionStorage.setItem(KEY_STORAGE, candidate); } catch (_) { /* ignore */ }
            showDashboard();
            applyStats(stats);
            await loadOrders();
            loadProducts().catch((error) => toast(error.message, true));
            refreshUnreadMessages();
        } catch (error) {
            if (error.status === 401) {
                try { sessionStorage.removeItem(KEY_STORAGE); } catch (_) { /* ignore */ }
                showGate("That key was not accepted. Check eva.admin.key in application.properties.");
            } else {
                showGate(error.message);
            }
        } finally {
            els.gateButton.disabled = false;
            els.gateButton.textContent = "Open dashboard";
        }
    }

    function applyStats(stats) {
        if (!stats) return;
        els.statTotal.textContent = String(stats.totalOrders);
        els.statPending.textContent = String(stats.pendingOrders);
        els.statPaid.textContent = String(stats.paidOrders);
        els.statRevenue.textContent = formatBirr(stats.revenue);
    }

    async function loadStats() {
        const stats = await request("/admin/stats", { headers: authHeaders() });
        applyStats(stats);
    }

    // --------------------------------- orders ---------------------------------

    async function loadOrders() {
        if (state.loading) return;
        state.loading = true;
        els.ordersBody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading orders…</td></tr>';
        try {
            const query = "/admin/orders?status=" + encodeURIComponent(state.status)
                + "&page=" + state.page + "&size=" + state.size;
            const data = await request(query, { headers: authHeaders() });
            renderTable(data);
            els.updatedAt.textContent = "Updated " + new Date().toLocaleTimeString("en-GB", {
                hour: "2-digit", minute: "2-digit"
            });
        } catch (error) {
            if (error.status === 401) {
                handleAuthError();
                return;
            }
            els.ordersBody.innerHTML = '<tr><td colspan="6" class="table-error" style="padding:2.5rem 1rem;text-align:center;color:#a52a2a">'
                + escapeHtml(error.message) + "</td></tr>";
        } finally {
            state.loading = false;
        }
    }

    function renderTable(data) {
        const content = (data && data.content) || [];
        state.totalPages = data ? Math.max(data.totalPages, 1) : 1;
        state.totalElements = data ? data.totalElements : 0;

        if (!content.length) {
            els.ordersBody.innerHTML = '<tr><td colspan="6" class="table-empty">'
                + (state.status === "ALL" ? "No orders yet. Share the shop link to get started." : "No orders with this status.")
                + "</td></tr>";
        } else {
            els.ordersBody.innerHTML = content.map(rowHtml).join("");
        }

        const from = content.length ? state.page * state.size + 1 : 0;
        const to = state.page * state.size + content.length;
        els.pagerInfo.textContent = "Showing " + from + "–" + to + " of " + state.totalElements
            + " · page " + (state.page + 1) + " of " + state.totalPages;
        els.prev.disabled = state.page <= 0;
        els.next.disabled = state.page + 1 >= state.totalPages;
    }

    function rowHtml(order) {
        const items = Array.isArray(order.items) ? order.items : [];
        const first = items[0];
        const extra = items.length > 1 ? " +" + (items.length - 1) + " more" : "";
        const itemText = first
            ? escapeHtml(first.productName) + ' <small>× ' + first.quantity + "</small>" + extra
            : "—";

        const options = STATUSES.map((status) =>
            '<option value="' + status + '"' + (status === order.status ? " selected" : "") + ">"
            + escapeHtml(statusLabel(status)) + "</option>"
        ).join("");

        return "<tr>"
            + '<td><div class="order-ref">' + escapeHtml(order.reference) + "</div>"
            + '<div class="order-date">' + escapeHtml(formatDate(order.createdAt)) + "</div></td>"
            + '<td><div class="cust-name">' + escapeHtml(order.customerName) + "</div>"
            + '<div class="cust-phone">' + escapeHtml(order.customerPhone) + "</div></td>"
            + '<td class="items-cell">' + itemText + "</td>"
            + '<td class="order-total">' + formatBirr(order.totalAmount) + "</td>"
            + '<td><span class="method-tag method-' + escapeHtml(order.paymentMethod) + '">'
            + escapeHtml(order.paymentMethod) + "</span></td>"
            + '<td><select class="status-select" data-ref="' + escapeHtml(order.reference)
            + '" data-status="' + escapeHtml(order.status) + '" aria-label="Status for '
            + escapeHtml(order.reference) + '">' + options + "</select></td>"
            + "</tr>";
    }

    function formatDate(value) {
        if (!value) return "—";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "—";
        return date.toLocaleString("en-GB", {
            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
        });
    }

    async function updateStatus(select) {
        const reference = select.getAttribute("data-ref");
        const status = select.value;
        select.disabled = true;
        try {
            await request("/admin/orders/" + encodeURIComponent(reference) + "/status", {
                method: "PATCH",
                headers: authHeaders(),
                body: JSON.stringify({ status: status })
            });
            select.setAttribute("data-status", status);
            toast(reference + " → " + statusLabel(status));
            await Promise.all([loadStats(), loadOrders()]);
        } catch (error) {
            if (error.status === 401) {
                handleAuthError();
                return;
            }
            toast(error.message, true);
            select.value = select.getAttribute("data-status");
        } finally {
            select.disabled = false;
        }
    }

    // -------------------------------- products --------------------------------

    async function loadProducts() {
        els.productsBody.innerHTML = '<tr><td colspan="7" class="table-loading">Loading products…</td></tr>';
        try {
            const query = "/admin/products"
                + (state.productSearch ? "?q=" + encodeURIComponent(state.productSearch) : "");
            const list = await request(query, { headers: authHeaders() });
            state.products = Array.isArray(list) ? list : [];
            state.productsLoaded = true;
            renderProducts();
            els.productsUpdated.textContent = state.products.length
                + (state.products.length === 1 ? " product" : " products");
        } catch (error) {
            if (error.status === 401) {
                handleAuthError();
                return;
            }
            els.productsBody.innerHTML = '<tr><td colspan="7" class="table-error" style="padding:2.5rem 1rem;text-align:center;color:#a52a2a">'
                + escapeHtml(error.message) + "</td></tr>";
            throw error;
        }
    }

    function renderProducts() {
        if (!state.products.length) {
            els.productsBody.innerHTML = '<tr><td colspan="7" class="table-empty">'
                + (state.productSearch
                    ? "No products match “" + escapeHtml(state.productSearch) + "”."
                    : "No products yet. Use “+ Add product” to create the first one.")
                + "</td></tr>";
            return;
        }
        els.productsBody.innerHTML = state.products.map(productRow).join("");
    }

    function productRow(product) {
        const tint = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(product.color || "")
            ? product.color : "#2f6fed";
        const thumb = product.imageUrl
            ? '<img src="' + escapeHtml(assetUrl(product.imageUrl)) + '" alt="" loading="lazy">'
            : productArt(product);
        const stockClass = product.stock <= 0 ? "is-out" : (product.stock <= 3 ? "is-low" : "");
        const stockText = product.stock <= 0 ? "Out of stock" : product.stock + " in stock";
        const categoryLabel = product.category === "SMARTPHONE" ? "Smartphone" : "Accessory";

        return "<tr>"
            + '<td><div class="thumb" style="--tint:' + escapeHtml(tint) + '">' + thumb + "</div></td>"
            + '<td><div class="prod-name">' + escapeHtml(product.name) + "</div>"
            + '<div class="prod-sub">' + escapeHtml(product.brand) + " · #" + product.id + "</div></td>"
            + '<td><span class="cat-tag cat-' + escapeHtml(product.category) + '">' + categoryLabel + "</span></td>"
            + '<td class="order-total">' + formatBirr(product.price) + "</td>"
            + '<td class="stock-cell ' + stockClass + '">' + escapeHtml(stockText) + "</td>"
            + '<td><label class="switch" title="Visible in the shop"><input type="checkbox" data-visible="'
            + product.id + '"' + (product.active ? " checked" : "")
            + ' aria-label="Visible in the shop"><span></span></label></td>'
            + '<td><div class="row-actions">'
            + '<button class="link-btn" type="button" data-edit="' + product.id + '">Edit</button>'
            + '<button class="link-btn is-danger" type="button" data-delete="' + product.id + '">Delete</button>'
            + "</div></td>"
            + "</tr>";
    }

    function findProduct(id) {
        return state.products.find((item) => String(item.id) === String(id)) || null;
    }

    async function toggleVisibility(input) {
        const product = findProduct(input.getAttribute("data-visible"));
        if (!product) return;
        input.disabled = true;
        try {
            const updated = await request("/admin/products/" + product.id + "/visibility", {
                method: "PATCH",
                headers: authHeaders(),
                body: JSON.stringify({ active: input.checked })
            });
            product.active = updated.active;
            toast(product.name + (input.checked ? " is now visible in the shop" : " is hidden from the shop"));
        } catch (error) {
            if (error.status === 401) {
                handleAuthError();
                return;
            }
            input.checked = !input.checked;
            toast(error.message, true);
        } finally {
            input.disabled = false;
        }
    }

    async function removeProduct(product) {
        const ok = window.confirm('Delete "' + product.name + '"?\n\nThis removes it from the shop for good. Past orders keep their record.');
        if (!ok) return;
        try {
            await request("/admin/products/" + product.id, { method: "DELETE", headers: authHeaders() });
            toast(product.name + " deleted");
            await Promise.all([loadProducts(), loadStats()]);
        } catch (error) {
            if (error.status === 401) {
                handleAuthError();
                return;
            }
            toast(error.message, true);
        }
    }

    // ----------------------------- product editor -----------------------------

    function normalizeColor(value) {
        return /^#([0-9a-fA-F]{6})$/.test(value || "") ? value : "#2f6fed";
    }

    function openEditor(product) {
        state.editing = product || null;
        state.existingImage = product && product.imageUrl ? product.imageUrl : null;
        state.pendingFile = null;
        els.pImage.value = "";
        els.formError.hidden = true;
        els.pName.value = product ? product.name : "";
        els.pBrand.value = product ? product.brand : "";
        els.pCategory.value = product ? product.category : "SMARTPHONE";
        els.pPrice.value = product ? String(product.price) : "";
        els.pStock.value = product ? String(product.stock) : "";
        els.pColor.value = normalizeColor(product && product.color);
        els.pDescription.value = product && product.description ? product.description : "";
        els.pFeatured.checked = Boolean(product && product.featured);
        els.pActive.checked = product ? Boolean(product.active) : true;
        els.pImageUrl.value = product && product.imageUrl
            && !String(product.imageUrl).startsWith("/uploads/") ? product.imageUrl : "";
        els.modalTitle.textContent = product ? "Edit product" : "Add product";
        els.modalEyebrow.textContent = product ? "Product #" + product.id : "New product";
        els.productSave.textContent = product ? "Save changes" : "Add product";
        setPreview();
        openModal();
        window.setTimeout(() => els.pName.focus(), 120);
    }

    function openModal() {
        els.modal.hidden = false;
        document.body.style.overflow = "hidden";
        window.requestAnimationFrame(() => els.modal.classList.add("is-open"));
    }

    function closeModal() {
        if (els.modal.hidden) return;
        els.modal.classList.remove("is-open");
        document.body.style.overflow = "";
        window.setTimeout(() => {
            if (!els.modal.classList.contains("is-open")) els.modal.hidden = true;
        }, 240);
    }

    function closeEditor() {
        closeModal();
        state.editing = null;
        state.existingImage = null;
        state.pendingFile = null;
        if (state.previewObjectUrl) {
            URL.revokeObjectURL(state.previewObjectUrl);
            state.previewObjectUrl = null;
        }
        els.formError.hidden = true;
    }

    function setPreview() {
        if (state.previewObjectUrl) {
            URL.revokeObjectURL(state.previewObjectUrl);
            state.previewObjectUrl = null;
        }
        const box = els.imagePreview;
        box.innerHTML = "";

        const link = els.pImageUrl.value.trim();
        if (state.pendingFile) {
            const url = URL.createObjectURL(state.pendingFile);
            state.previewObjectUrl = url;
            box.innerHTML = '<img src="' + url + '" alt="Selected photo">';
            els.removeImage.disabled = false;
            return;
        }
        const source = link || state.existingImage;
        if (source) {
            box.innerHTML = '<img src="' + escapeHtml(assetUrl(source)) + '" alt="Product photo">';
            const img = box.querySelector("img");
            if (img) {
                img.addEventListener("error", () => {
                    box.innerHTML = productArt({
                        category: els.pCategory.value,
                        color: normalizeColor(els.pColor.value)
                    });
                }, { once: true });
            }
            els.removeImage.disabled = false;
            return;
        }
        box.innerHTML = productArt({
            category: els.pCategory.value,
            color: normalizeColor(els.pColor.value)
        });
        els.removeImage.disabled = true;
    }

    function handleFile(file) {
        if (!file) return;
        if (IMAGE_TYPES.indexOf(file.type) === -1) {
            showFormError("Choose a JPG, PNG, WebP or GIF image.");
            els.pImage.value = "";
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            showFormError("Image must be 5 MB or smaller.");
            els.pImage.value = "";
            return;
        }
        state.pendingFile = file;
        els.pImageUrl.value = "";
        els.formError.hidden = true;
        setPreview();
    }

    function clearImage() {
        state.pendingFile = null;
        state.existingImage = null;
        els.pImage.value = "";
        els.pImageUrl.value = "";
        setPreview();
    }

    function showFormError(message) {
        els.formError.textContent = message;
        els.formError.hidden = false;
        els.formError.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return null;
    }

    function readForm() {
        const name = els.pName.value.trim();
        if (!name) return showFormError("Product name is required.");
        const brand = els.pBrand.value.trim();
        if (!brand) return showFormError("Brand is required.");

        const priceRaw = els.pPrice.value.trim();
        if (priceRaw === "") return showFormError("Price is required.");
        const price = Number(priceRaw);
        if (!Number.isFinite(price) || price < 0) return showFormError("Enter a valid price in ETB.");

        const stockRaw = els.pStock.value.trim();
        const stock = stockRaw === "" ? 0 : Number(stockRaw);
        if (!Number.isInteger(stock) || stock < 0) return showFormError("Stock must be a whole number, 0 or more.");

        const link = els.pImageUrl.value.trim();
        let imageUrl;
        if (link) {
            imageUrl = link;
        } else if (state.pendingFile) {
            imageUrl = state.existingImage;
        } else {
            imageUrl = state.existingImage;
        }

        return {
            name: name,
            brand: brand,
            category: els.pCategory.value,
            price: price,
            stock: stock,
            description: els.pDescription.value.trim() || null,
            color: els.pColor.value,
            featured: els.pFeatured.checked,
            active: els.pActive.checked,
            imageUrl: imageUrl || null
        };
    }

    async function saveProduct(event) {
        event.preventDefault();
        if (state.saving) return;
        const payload = readForm();
        if (!payload) return;

        const wasEditing = Boolean(state.editing);
        state.saving = true;
        els.productSave.disabled = true;
        els.productSave.textContent = "Saving…";
        els.formError.hidden = true;

        try {
            let saved;
            if (wasEditing) {
                saved = await request("/admin/products/" + state.editing.id, {
                    method: "PUT",
                    headers: authHeaders(),
                    body: JSON.stringify(payload)
                });
            } else {
                saved = await request("/admin/products", {
                    method: "POST",
                    headers: authHeaders(),
                    body: JSON.stringify(payload)
                });
            }

            if (state.pendingFile) {
                const form = new FormData();
                form.append("file", state.pendingFile);
                saved = await requestMultipart("/admin/products/" + saved.id + "/image", form, {
                    headers: authHeaders()
                });
            }

            toast(wasEditing ? "Product updated" : "Product added");
            closeEditor();
            await Promise.all([loadProducts(), loadStats()]);
        } catch (error) {
            if (error.status === 401) {
                handleAuthError();
                return;
            }
            showFormError(error.message);
        } finally {
            state.saving = false;
            els.productSave.disabled = false;
            els.productSave.textContent = wasEditing ? "Save changes" : "Add product";
        }
    }

    // --------------------------------- views ----------------------------------

    // -------------------------------- site text --------------------------------

    function settingFields() {
        return $$("#settingsForm [data-setting]");
    }

    function fillSettings(settings, stamped) {
        settingFields().forEach((input) => {
            const value = settings[input.getAttribute("data-setting")];
            input.value = typeof value === "string" ? value : "";
        });
        if (stamped) {
            els.settingsUpdated.textContent = "Saved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }
    }

    async function loadSettings() {
        els.settingsSave.disabled = true;
        try {
            const settings = await request("/admin/settings", { headers: authHeaders() });
            state.settingsLoaded = true;
            fillSettings(settings, false);
        } catch (error) {
            if (error.status === 401) {
                handleAuthError();
                return;
            }
            toast(error.message, true);
        } finally {
            els.settingsSave.disabled = false;
        }
    }

    async function saveSettings(event) {
        event.preventDefault();
        if (state.settingsSaving) return;

        const changes = {};
        settingFields().forEach((input) => {
            changes[input.getAttribute("data-setting")] = input.value.trim();
        });

        state.settingsSaving = true;
        els.settingsSave.disabled = true;
        els.settingsSave.textContent = "Saving…";
        try {
            const settings = await request("/admin/settings", {
                method: "PUT",
                headers: authHeaders(),
                body: JSON.stringify(changes)
            });
            fillSettings(settings, true);
            toast("Site text saved. Refresh the shop to see it.");
        } catch (error) {
            if (error.status === 401) {
                handleAuthError();
                return;
            }
            toast(error.message, true);
        } finally {
            state.settingsSaving = false;
            els.settingsSave.disabled = false;
            els.settingsSave.textContent = "Save text";
        }
    }

    async function resetSettings() {
        if (!window.confirm("Put every homepage text back to its original wording?")) return;
        els.settingsReset.disabled = true;
        try {
            const settings = await request("/admin/settings", {
                method: "DELETE",
                headers: authHeaders()
            });
            fillSettings(settings, true);
            toast("Homepage text reset to defaults.");
        } catch (error) {
            if (error.status === 401) {
                handleAuthError();
                return;
            }
            toast(error.message, true);
        } finally {
            els.settingsReset.disabled = false;
        }
    }

    async function refreshUnreadMessages() {
        if (!state.key || !els.messagesUnreadBadge) return;
        try {
            const data = await request("/admin/messages/unread-count", { headers: authHeaders() });
            const count = Number(data && data.count || 0);
            els.messagesUnreadBadge.textContent = String(count);
            els.messagesUnreadBadge.style.display = count > 0 ? "inline-block" : "none";
        } catch (_) { /* ignore */ }
    }

    function dmBubble(message) {
        const mine = message.sender === "ADMIN";
        const bg = mine ? "#07173f" : "#fff";
        const color = mine ? "#fff" : "#22314f";
        const border = mine ? "none" : "1px solid #e4ebf6";
        const align = mine ? "end" : "start";
        return '<div style="justify-self:' + align + ';max-width:92%;">'
            + '<div style="background:' + bg + ';color:' + color + ';border:' + border + ';border-radius:14px;padding:.55rem .7rem;font-size:.86rem;line-height:1.45;box-shadow:0 4px 14px rgba(13,21,38,.06);">'
            + escapeHtml(message.body || "") + '</div>'
            + '<div style="font-size:.66rem;color:#8593aa;padding:.15rem .2rem 0;text-align:' + (mine ? "right" : "left") + ';">'
            + escapeHtml(message.sender === "ADMIN" ? "Admin" : "Customer") + ' · ' + escapeHtml(formatDate(message.createdAt)) + '</div></div>';
    }

    async function loadMessages() {
        if (!els.messagesThreadsBody) return;
        els.messagesThreadsBody.innerHTML = '<tr><td colspan="3" class="table-loading">Loading messages…</td></tr>';
        try {
            const query = "/admin/messages?status=" + encodeURIComponent(state.messagesStatus)
                + "&page=" + state.messagesPage + "&size=" + state.messagesSize;
            const data = await request(query, { headers: authHeaders() });
            const content = (data && data.content) || [];
            state.messagesTotalPages = data ? Math.max(data.totalPages, 1) : 1;
            if (!content.length) {
                els.messagesThreadsBody.innerHTML = '<tr><td colspan="3" class="table-empty">No conversations found.</td></tr>';
            } else {
                els.messagesThreadsBody.innerHTML = content.map((t) => {
                    const unread = t.unreadForAdmin ? ' <span style="color:#ff6a00;font-weight:700;">●</span>' : '';
                    const selected = state.selectedThreadCode === t.threadCode ? ' style="background:#f3f7ff"' : '';
                    return '<tr data-thread="' + escapeHtml(t.threadCode) + '"' + selected + '>'
                        + '<td><div class="order-ref">' + escapeHtml(t.threadCode) + unread + '</div>'
                        + '<div class="cust-name">' + escapeHtml(t.customerName || "") + '</div>'
                        + '<div class="cust-phone">' + escapeHtml(t.customerPhone || "") + '</div></td>'
                        + '<td><span class="status-chip status-' + (t.status === "OPEN" ? "PAID" : "CANCELLED") + '">' + escapeHtml(t.status || "") + '</span></td>'
                        + '<td class="order-date">' + escapeHtml(formatDate(t.updatedAt || t.lastMessageAt)) + '</td></tr>';
                }).join("");
            }
            const from = content.length ? state.messagesPage * state.messagesSize + 1 : 0;
            const to = state.messagesPage * state.messagesSize + content.length;
            if (els.messagesPagerInfo) els.messagesPagerInfo.textContent = "Showing " + from + "–" + to + " of " + (data ? data.totalElements : 0) + " · page " + (state.messagesPage + 1) + " of " + state.messagesTotalPages;
            if (els.messagesPrev) els.messagesPrev.disabled = state.messagesPage <= 0;
            if (els.messagesNext) els.messagesNext.disabled = state.messagesPage + 1 >= state.messagesTotalPages;
            if (els.messagesUpdated) els.messagesUpdated.textContent = "Updated " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
            state.messagesLoaded = true;
            refreshUnreadMessages();
        } catch (error) {
            if (error.status === 401) { handleAuthError(); return; }
            els.messagesThreadsBody.innerHTML = '<tr><td colspan="3" class="table-error" style="padding:2rem 1rem;text-align:center;color:#a52a2a">' + escapeHtml(error.message) + '</td></tr>';
            throw error;
        }
    }

    function renderDmThread(thread) {
        state.selectedThreadCode = thread.threadCode;
        if (els.dmThreadTitle) els.dmThreadTitle.textContent = thread.customerName || thread.threadCode;
        if (els.dmThreadMeta) els.dmThreadMeta.textContent = thread.threadCode + " · " + (thread.customerPhone || "") + (thread.subject ? " · " + thread.subject : "");
        if (els.dmThreadInfo) els.dmThreadInfo.textContent = "Status: " + (thread.status || "") + " · Last activity: " + formatDate(thread.lastMessageAt || thread.updatedAt);
        if (els.dmThreadStatus) { els.dmThreadStatus.disabled = false; els.dmThreadStatus.value = thread.status || "OPEN"; }
        if (els.dmReplyInput) els.dmReplyInput.disabled = false;
        if (els.dmReplySend) els.dmReplySend.disabled = false;
        if (els.dmMessagesLog) {
            const msgs = thread.messages || [];
            els.dmMessagesLog.innerHTML = msgs.length ? msgs.map(dmBubble).join("") : '<div class="muted">No messages yet.</div>';
            els.dmMessagesLog.scrollTop = els.dmMessagesLog.scrollHeight;
        }
    }

    async function openDmThread(threadCode) {
        if (!threadCode) return;
        try {
            const thread = await request("/admin/messages/" + encodeURIComponent(threadCode), { headers: authHeaders() });
            renderDmThread(thread);
            await loadMessages(); // refresh list/unread state
        } catch (error) {
            if (error.status === 401) { handleAuthError(); return; }
            toast(error.message, true);
        }
    }

    async function sendDmReply(event) {
        event.preventDefault();
        if (!state.selectedThreadCode || !els.dmReplyInput) return;
        const body = els.dmReplyInput.value.trim();
        if (!body) return;
        els.dmReplySend.disabled = true;
        try {
            const thread = await request("/admin/messages/" + encodeURIComponent(state.selectedThreadCode) + "/reply", {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ message: body })
            });
            els.dmReplyInput.value = "";
            renderDmThread(thread);
            await loadMessages();
            toast("Reply sent");
        } catch (error) {
            if (error.status === 401) { handleAuthError(); return; }
            toast(error.message, true);
        } finally {
            els.dmReplySend.disabled = false;
        }
    }

    async function updateDmStatus() {
        if (!state.selectedThreadCode || !els.dmThreadStatus) return;
        try {
            const thread = await request("/admin/messages/" + encodeURIComponent(state.selectedThreadCode) + "/status", {
                method: "PATCH",
                headers: authHeaders(),
                body: JSON.stringify({ status: els.dmThreadStatus.value })
            });
            renderDmThread(thread);
            await loadMessages();
        } catch (error) {
            if (error.status === 401) { handleAuthError(); return; }
            toast(error.message, true);
        }
    }

    function pct(part, total) {
        if (!total) return "0%";
        return Math.round((part / total) * 100) + "%";
    }

    function barRow(label, value, total, extra) {
        const p = total ? Math.max(4, Math.round((value / total) * 100)) : 0;
        return '<div><div style="display:flex;justify-content:space-between;gap:.75rem;margin-bottom:.2rem;"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(String(value)) + (extra ? ' <span style="color:#8593aa;font-weight:600">' + escapeHtml(extra) + '</span>' : '') + '</strong></div>'
            + '<div style="height:8px;background:#e9eef8;border-radius:999px;overflow:hidden;"><div style="height:100%;width:' + p + '%;background:linear-gradient(90deg,#ff6a00,#ff9a52);border-radius:999px;"></div></div></div>';
    }

    async function loadAnalysis() {
        if (!els.analysisView) return;
        if (els.analysisStatusBreakdown) els.analysisStatusBreakdown.innerHTML = "Loading…";
        if (els.analysisPayments) els.analysisPayments.innerHTML = "Loading…";
        if (els.analysisCallbacks) els.analysisCallbacks.innerHTML = "Loading…";
        if (els.analysisProducts) els.analysisProducts.innerHTML = "Loading…";
        if (els.analysisRecentOrders) els.analysisRecentOrders.innerHTML = '<tr><td colspan="6" class="table-loading">Loading…</td></tr>';

        try {
            const [stats, ordersPage, callbackStats, callbacksPage, products] = await Promise.all([
                request("/admin/stats", { headers: authHeaders() }),
                request("/admin/orders?status=ALL&page=0&size=100", { headers: authHeaders() }),
                request("/admin/callbacks/stats", { headers: authHeaders() }).catch(() => null),
                request("/admin/callbacks?status=ALL&page=0&size=100", { headers: authHeaders() }).catch(() => null),
                request("/admin/products", { headers: authHeaders() }).catch(() => [])
            ]);

            applyStats(stats);

            const orders = (ordersPage && ordersPage.content) || [];
            const callbacks = (callbacksPage && callbacksPage.content) || [];
            const productList = Array.isArray(products) ? products : [];
            const totalOrders = (stats && Number(stats.totalOrders)) || orders.length || 0;
            const paidCount = (stats && Number(stats.paidOrders)) || 0;
            const delivered = orders.filter((o) => o.status === "DELIVERED").length;
            const paidInSample = orders.filter((o) => o.status === "PAID").length;
            const conversionBase = totalOrders || 0;
            const converted = (stats ? (Number(stats.paidOrders) + (ordersPage && ordersPage.totalElements ? 0 : 0)) : (paidInSample + delivered));
            // Use sample statuses for breakdown; totals from stats where possible
            const statusCounts = { PENDING_PAYMENT: 0, PAID: 0, DELIVERED: 0, FAILED: 0, CANCELLED: 0 };
            orders.forEach((o) => { if (statusCounts[o.status] != null) statusCounts[o.status] += 1; });
            if (stats) {
                statusCounts.PENDING_PAYMENT = Number(stats.pendingOrders || 0);
                // paidOrders is paid; delivered not separately in AdminStats, keep sample for it
            }
            const sampleTotal = orders.length || 1;

            if (els.anOrdersToday) els.anOrdersToday.textContent = stats ? String(stats.ordersToday || 0) : "—";
            if (els.anConversion) els.anConversion.textContent = conversionBase ? pct(paidCount, conversionBase) : "—";
            if (els.anCallbacksNew) els.anCallbacksNew.textContent = callbackStats ? String(callbackStats.newCount || 0) : "—";
            if (els.anRevenue) els.anRevenue.textContent = stats ? formatBirr(stats.revenue) : "—";

            if (els.analysisStatusBreakdown) {
                const rows = [
                    ["Pending payment", statusCounts.PENDING_PAYMENT, conversionBase || sampleTotal],
                    ["Paid", statusCounts.PAID, conversionBase || sampleTotal],
                    ["Delivered (sample)", statusCounts.DELIVERED, sampleTotal],
                    ["Failed (sample)", statusCounts.FAILED, sampleTotal],
                    ["Cancelled (sample)", statusCounts.CANCELLED, sampleTotal]
                ];
                els.analysisStatusBreakdown.innerHTML = rows.map((r) => barRow(r[0], r[1], r[2], "(" + pct(r[1], r[2] || 1) + ")")).join("");
            }

            if (els.analysisPayments) {
                const methods = {};
                orders.forEach((o) => { methods[o.paymentMethod || "UNKNOWN"] = (methods[o.paymentMethod || "UNKNOWN"] || 0) + 1; });
                const entries = Object.keys(methods).map((k) => [k, methods[k]]).sort((a, b) => b[1] - a[1]);
                els.analysisPayments.innerHTML = entries.length
                    ? entries.map((e) => barRow(e[0] === "TELEBIRR" ? "Telebirr" : e[0] === "CBE" ? "CBE Birr" : e[0], e[1], sampleTotal, "(" + pct(e[1], sampleTotal) + ")")).join("")
                    : '<div class="muted">No order data in sample.</div>';
            }

            if (els.analysisCallbacks) {
                if (callbackStats) {
                    const topics = {};
                    callbacks.forEach((c) => { const t = c.topic || "Other"; topics[t] = (topics[t] || 0) + 1; });
                    const topTopics = Object.keys(topics).map((k) => [k, topics[k]]).sort((a,b)=>b[1]-a[1]).slice(0,4);
                    els.analysisCallbacks.innerHTML = [
                        barRow("New", callbackStats.newCount || 0, callbackStats.total || 1, "(" + pct(callbackStats.newCount || 0, callbackStats.total || 1) + ")"),
                        barRow("Contacted", callbackStats.contacted || 0, callbackStats.total || 1, "(" + pct(callbackStats.contacted || 0, callbackStats.total || 1) + ")"),
                        barRow("Closed", callbackStats.closed || 0, callbackStats.total || 1, "(" + pct(callbackStats.closed || 0, callbackStats.total || 1) + ")"),
                        '<div style="margin-top:.4rem;color:#8593aa;font-size:.8rem;">Total callbacks: <strong style="color:#33415c">' + escapeHtml(String(callbackStats.total || 0)) + '</strong></div>',
                        topTopics.length ? '<div style="margin-top:.3rem;color:#8593aa;font-size:.8rem;">Top topics: ' + topTopics.map((t)=>escapeHtml(t[0]) + ' (' + t[1] + ')').join(", ") + '</div>' : ''
                    ].join("");
                } else {
                    els.analysisCallbacks.innerHTML = '<div class="muted">Callback analytics unavailable (API endpoint not reachable).</div>';
                }
            }

            if (els.analysisProducts) {
                const active = productList.filter((p) => p.active).length;
                const hidden = productList.length - active;
                const smartphones = productList.filter((p) => p.category === "SMARTPHONE").length;
                const accessories = productList.filter((p) => p.category === "ACCESSORY").length;
                const out = productList.filter((p) => Number(p.stock) <= 0).length;
                const low = productList.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= 3).length;
                const totalStock = productList.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
                const total = productList.length || 1;
                els.analysisProducts.innerHTML = [
                    barRow("Visible products", active, total, "(" + pct(active, total) + ")"),
                    barRow("Hidden products", hidden, total, "(" + pct(hidden, total) + ")"),
                    barRow("Smartphones", smartphones, total, "(" + pct(smartphones, total) + ")"),
                    barRow("Accessories", accessories, total, "(" + pct(accessories, total) + ")"),
                    '<div style="display:grid;gap:.25rem;margin-top:.2rem;color:#33415c;">'
                        + '<div>Out of stock: <strong>' + out + '</strong> · Low stock (1-3): <strong>' + low + '</strong></div>'
                        + '<div>Total units in stock: <strong>' + totalStock + '</strong></div></div>'
                ].join("");
            }

            if (els.analysisRecentOrders) {
                const recent = orders.slice(0, 10);
                els.analysisRecentOrders.innerHTML = recent.length ? recent.map((order) => {
                    return "<tr>"
                        + '<td><div class="order-ref">' + escapeHtml(order.reference) + "</div></td>"
                        + '<td><div class="cust-name">' + escapeHtml(order.customerName || "") + '</div><div class="cust-phone">' + escapeHtml(order.customerPhone || "") + "</div></td>"
                        + '<td class="order-total">' + formatBirr(order.totalAmount) + "</td>"
                        + '<td><span class="method-tag method-' + escapeHtml(order.paymentMethod || "") + '">' + escapeHtml(order.paymentMethod || "") + "</span></td>"
                        + '<td><span class="status-chip status-' + escapeHtml(order.status || "") + '">' + escapeHtml(statusLabel(order.status || "")) + "</span></td>"
                        + '<td class="order-date">' + escapeHtml(formatDate(order.createdAt)) + "</td>"
                        + "</tr>";
                }).join("") : '<tr><td colspan="6" class="table-empty">No orders available for analysis yet.</td></tr>';
            }

            state.analysisLoaded = true;
            if (els.analysisUpdated) {
                els.analysisUpdated.textContent = "Updated " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
            }
        } catch (error) {
            if (error.status === 401) {
                handleAuthError();
                return;
            }
            if (els.analysisStatusBreakdown) els.analysisStatusBreakdown.innerHTML = '<div style="color:#a52a2a">' + escapeHtml(error.message) + '</div>';
            if (els.analysisPayments) els.analysisPayments.innerHTML = '<div style="color:#a52a2a">' + escapeHtml(error.message) + '</div>';
            if (els.analysisCallbacks) els.analysisCallbacks.innerHTML = '<div style="color:#a52a2a">' + escapeHtml(error.message) + '</div>';
            if (els.analysisProducts) els.analysisProducts.innerHTML = '<div style="color:#a52a2a">' + escapeHtml(error.message) + '</div>';
            throw error;
        }
    }

    function switchView(view) {
        state.view = view;
        $$(".admin-tab").forEach((tab) => {
            const active = tab.getAttribute("data-view") === view;
            tab.classList.toggle("is-active", active);
            tab.setAttribute("aria-selected", active ? "true" : "false");
        });
        els.ordersView.hidden = view !== "orders";
        els.productsView.hidden = view !== "products";
        if (els.analysisView) els.analysisView.hidden = view !== "analysis";
        if (els.messagesView) els.messagesView.hidden = view !== "messages";
        els.settingsView.hidden = view !== "settings";
        if (view === "products" && !state.productsLoaded) {
            loadProducts().catch((error) => toast(error.message, true));
        }
        if (view === "analysis" && !state.analysisLoaded) {
            loadAnalysis().catch((error) => toast(error.message, true));
        }
        if (view === "messages" && !state.messagesLoaded) {
            loadMessages().catch((error) => toast(error.message, true));
        }
        if (view === "settings" && !state.settingsLoaded) {
            loadSettings();
        }
    }

    function toast(message, isError) {
        let node = $(".admin-toast");
        if (node) node.remove();
        node = document.createElement("div");
        node.className = "admin-toast" + (isError ? " is-error" : "");
        node.textContent = message;
        document.body.appendChild(node);
        window.setTimeout(() => node.remove(), 3200);
    }

    function bindEvents() {
        els.gateForm.addEventListener("submit", (event) => {
            event.preventDefault();
            signIn(els.keyInput.value);
        });

        els.logout.addEventListener("click", () => {
            try { sessionStorage.removeItem(KEY_STORAGE); } catch (_) { /* ignore */ }
            state.key = "";
            els.keyInput.value = "";
            showGate();
        });

        $$(".admin-tab").forEach((tab) => {
            tab.addEventListener("click", () => switchView(tab.getAttribute("data-view")));
        });

        els.statusFilter.addEventListener("change", () => {
            state.status = els.statusFilter.value;
            state.page = 0;
            loadOrders();
        });

        els.refresh.addEventListener("click", () => {
            Promise.all([loadStats(), loadOrders()]).catch((error) => toast(error.message, true));
        });

        els.prev.addEventListener("click", () => {
            if (state.page <= 0) return;
            state.page -= 1;
            loadOrders();
        });

        els.next.addEventListener("click", () => {
            if (state.page + 1 >= state.totalPages) return;
            state.page += 1;
            loadOrders();
        });

        els.ordersBody.addEventListener("change", (event) => {
            const select = event.target.closest(".status-select");
            if (select) updateStatus(select);
        });

        // Products
        els.refreshProducts.addEventListener("click", () => {
            loadProducts().catch((error) => toast(error.message, true));
        });

        if (els.refreshAnalysis) {
            els.refreshAnalysis.addEventListener("click", () => {
                loadAnalysis().catch((error) => toast(error.message, true));
            });
        }

        if (els.refreshMessages) {
            els.refreshMessages.addEventListener("click", () => {
                loadMessages().catch((error) => toast(error.message, true));
            });
        }
        if (els.messagesFilter) {
            els.messagesFilter.addEventListener("change", () => {
                state.messagesStatus = els.messagesFilter.value;
                state.messagesPage = 0;
                loadMessages().catch((error) => toast(error.message, true));
            });
        }
        if (els.messagesPrev) {
            els.messagesPrev.addEventListener("click", () => {
                if (state.messagesPage <= 0) return;
                state.messagesPage -= 1;
                loadMessages().catch((error) => toast(error.message, true));
            });
        }
        if (els.messagesNext) {
            els.messagesNext.addEventListener("click", () => {
                if (state.messagesPage + 1 >= state.messagesTotalPages) return;
                state.messagesPage += 1;
                loadMessages().catch((error) => toast(error.message, true));
            });
        }
        if (els.messagesThreadsBody) {
            els.messagesThreadsBody.addEventListener("click", (event) => {
                const row = event.target.closest("tr[data-thread]");
                if (row) openDmThread(row.getAttribute("data-thread"));
            });
        }
        if (els.dmReplyForm) {
            els.dmReplyForm.addEventListener("submit", sendDmReply);
        }
        if (els.dmThreadStatus) {
            els.dmThreadStatus.addEventListener("change", updateDmStatus);
        }

        // Site text
        els.settingsForm.addEventListener("submit", saveSettings);
        els.settingsReset.addEventListener("click", resetSettings);

        let searchTimer = null;
        els.productSearch.addEventListener("input", () => {
            window.clearTimeout(searchTimer);
            searchTimer = window.setTimeout(() => {
                state.productSearch = els.productSearch.value.trim();
                loadProducts().catch((error) => toast(error.message, true));
            }, 250);
        });

        els.addProductButton.addEventListener("click", () => openEditor(null));

        els.productsBody.addEventListener("change", (event) => {
            const toggle = event.target.closest("input[data-visible]");
            if (toggle) toggleVisibility(toggle);
        });

        els.productsBody.addEventListener("click", (event) => {
            const editButton = event.target.closest("[data-edit]");
            if (editButton) {
                const product = findProduct(editButton.getAttribute("data-edit"));
                if (product) openEditor(product);
                return;
            }
            const deleteButton = event.target.closest("[data-delete]");
            if (deleteButton) {
                const product = findProduct(deleteButton.getAttribute("data-delete"));
                if (product) removeProduct(product);
            }
        });

        // Editor
        els.form.addEventListener("submit", saveProduct);
        els.modalClose.addEventListener("click", closeEditor);
        els.productCancel.addEventListener("click", closeEditor);
        els.modal.addEventListener("click", (event) => {
            if (event.target === els.modal) closeEditor();
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !els.modal.hidden) closeEditor();
        });

        els.chooseImage.addEventListener("click", () => els.pImage.click());
        els.pImage.addEventListener("change", () => handleFile(els.pImage.files[0]));
        els.removeImage.addEventListener("click", clearImage);

        els.pImageUrl.addEventListener("input", () => {
            if (els.pImageUrl.value.trim() && state.pendingFile) {
                state.pendingFile = null;
                els.pImage.value = "";
            }
            if (!state.pendingFile) setPreview();
        });

        els.pCategory.addEventListener("change", () => {
            if (!state.pendingFile) setPreview();
        });
        els.pColor.addEventListener("input", () => {
            if (!state.pendingFile && !els.pImageUrl.value.trim() && !state.existingImage) setPreview();
        });
    }

    function init() {
        cacheElements();
        bindEvents();
        let stored = "";
        try { stored = sessionStorage.getItem(KEY_STORAGE) || ""; } catch (_) { /* ignore */ }
        if (stored) {
            els.keyInput.value = stored;
            signIn(stored);
        } else {
            showGate();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();

