/* Shared helpers: API base URL, fetch wrapper, formatting, artwork. */
(function () {
    "use strict";

    const host = location.hostname;
    let base;

    if (window.EVA_API_BASE) {
        base = String(window.EVA_API_BASE).replace(/\/+$/, "");
    } else if (location.protocol === "file:" || !host) {
        base = "http://localhost:8080/api";
    } else if ((host === "localhost" || host === "127.0.0.1") && location.port !== "8080") {
        // Static site served by XAMPP/Herd while the API runs on 8080.
        base = "http://localhost:8080/api";
    } else {
        base = location.origin + "/api";
    }

    async function readResponse(response) {
        const text = await response.text();
        let data = null;
        if (text) {
            try { data = JSON.parse(text); } catch (_) { data = text; }
        }

        if (!response.ok) {
            const message = (data && data.message) || ("Request failed with status " + response.status);
            const error = new Error(message);
            error.status = response.status;
            error.data = data;
            throw error;
        }
        return data;
    }

    async function request(path, options) {
        const opts = options || {};
        const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
        const rest = Object.assign({}, opts);
        delete rest.headers;

        let response;
        try {
            response = await fetch(base + path, Object.assign({}, rest, { headers }));
        } catch (cause) {
            const error = new Error("Cannot reach the Eva Mobile server. Is the backend running on port 8080?");
            error.offline = true;
            error.cause = cause;
            throw error;
        }
        return readResponse(response);
    }

    /** Like request(), but sends FormData (file uploads) without a JSON content type. */
    async function requestMultipart(path, formData, options) {
        const opts = options || {};
        let response;
        try {
            response = await fetch(base + path, {
                method: opts.method || "POST",
                headers: opts.headers || {},
                body: formData
            });
        } catch (cause) {
            const error = new Error("Cannot reach the Eva Mobile server. Is the backend running on port 8080?");
            error.offline = true;
            error.cause = cause;
            throw error;
        }
        return readResponse(response);
    }

    function formatBirr(value) {
        const n = Number(value || 0);
        const options = Number.isInteger(n)
            ? { maximumFractionDigits: 0 }
            : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
        return n.toLocaleString("en-US", options) + " ETB";
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function sortProducts(list) {
        return list.slice().sort(function (a, b) {
            if (a.featured !== b.featured) return a.featured ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
    }

    /** The API origin (without /api) so uploaded photos resolve from any host. */
    const origin = base.replace(/\/api$/, "");

    function assetUrl(path) {
        if (!path) return "";
        const value = String(path);
        if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) return value;
        if (value.charAt(0) === "/") return origin + value;
        return value;
    }

    /** Inline SVG artwork so the shop looks complete without photo assets. */
    function productArt(product, className) {
        const color = /^#[0-9a-f]{3,8}$/i.test(product.color || "") ? product.color : "#2f6fed";
        const cls = className ? ' class="' + className + '"' : "";
        if (product.category === "ACCESSORY") {
            return '<svg viewBox="0 0 120 140" role="img" aria-hidden="true"' + cls + '>'
                + '<rect x="18" y="16" width="84" height="108" rx="20" fill="#ffffff" fill-opacity=".72" stroke="' + color + '" stroke-opacity=".35" stroke-width="2"/>'
                + '<rect x="30" y="30" width="60" height="60" rx="14" fill="' + color + '" fill-opacity=".12"/>'
                + '<path d="M66 34 46 76h12l-4 30 22-42H62l4-30Z" fill="' + color + '"/>'
                + '<rect x="30" y="100" width="60" height="8" rx="4" fill="' + color + '" fill-opacity=".22"/>'
                + '</svg>';
        }
        return '<svg viewBox="0 0 120 180" role="img" aria-hidden="true"' + cls + '>'
            + '<rect x="20" y="7" width="80" height="166" rx="17" fill="#101827"/>'
            + '<rect x="25" y="12" width="70" height="156" rx="12" fill="' + color + '"/>'
            + '<rect x="25" y="12" width="70" height="64" rx="12" fill="#ffffff" fill-opacity=".16"/>'
            + '<rect x="46" y="18" width="28" height="6" rx="3" fill="#101827" fill-opacity=".5"/>'
            + '<circle cx="60" cy="33" r="4.5" fill="#101827" fill-opacity=".38"/>'
            + '<circle cx="60" cy="33" r="2" fill="#ffffff" fill-opacity=".55"/>'
            + '<rect x="33" y="98" width="54" height="6" rx="3" fill="#ffffff" fill-opacity=".3"/>'
            + '<rect x="33" y="112" width="34" height="6" rx="3" fill="#ffffff" fill-opacity=".22"/>'
            + '<circle cx="60" cy="150" r="6" fill="#ffffff" fill-opacity=".25"/>'
            + '</svg>';
    }

    function statusLabel(status) {
        return String(status || "").replace(/_/g, " ").toLowerCase()
            .replace(/^\w/, function (c) { return c.toUpperCase(); });
    }

    /** Real photo when the owner uploaded one, otherwise the branded SVG artwork. */
    function productVisual(product, className) {
        const p = product || {};
        if (p.imageUrl) {
            return '<img src="' + escapeHtml(assetUrl(p.imageUrl)) + '" alt="'
                + escapeHtml(p.name || "Product") + '" loading="lazy" decoding="async"'
                + (className ? ' class="' + className + '"' : "") + ">";
        }
        return productArt(p, className);
    }

    function methodLabel(method) {
        const value = String(method || "").toUpperCase();
        if (value === "TELEBIRR") return "Telebirr";
        if (value === "CBE") return "CBE Birr";
        return statusLabel(method);
    }

    /** Contact details for the MBO Digital call center (owner-supplied). */
    const MBO = {
        name: "MBO Digital",
        phones: [
            { display: "+251 910 695 378", tel: "+251910695378" },
            { display: "+251 912 450 661", tel: "+251912450661" }
        ],
        telegram: { label: "@Ashuman124", url: "https://t.me/Ashuman124" },
        tiktok: { label: "@mbodigitalcode1", url: "https://www.tiktok.com/@mbodigitalcode1" }
    };

    window.EVA = {
        API_BASE: base,
        request: request,
        requestMultipart: requestMultipart,
        formatBirr: formatBirr,
        escapeHtml: escapeHtml,
        sortProducts: sortProducts,
        assetUrl: assetUrl,
        productArt: productArt,
        productVisual: productVisual,
        statusLabel: statusLabel,
        methodLabel: methodLabel,
        mbo: MBO
    };
})();
