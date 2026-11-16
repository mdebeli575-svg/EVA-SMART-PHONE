package com.evamobile.service;

import com.evamobile.domain.SiteSetting;
import com.evamobile.repo.SiteSettingRepository;
import com.evamobile.web.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Storefront text the owner can edit from the dashboard. Defaults live in code;
 * the database only holds differences, so a fresh install always renders.
 */
@Service
public class SettingsService {

    /** Ordered so the admin form and API responses stay readable. */
    private static final Map<String, String> DEFAULTS;
    private static final Map<String, Integer> LIMITS;

    static {
        Map<String, String> defaults = new LinkedHashMap<>();
        defaults.put("tagline", "Smart Choice... Better Life");
        defaults.put("heroEyebrow", "Megenagna · Addis Ababa");
        defaults.put("heroLine1", "Original phones.");
        defaults.put("heroLine2", "Honest prices.");
        defaults.put("heroAccent", "Delivered to your door.");
        defaults.put("heroLead", "Eva Mobile is your trusted smartphone and accessories store. "
                + "Genuine devices, expert setup, and fast delivery across Addis Ababa — "
                + "pay securely with Telebirr or CBE Birr.");
        defaults.put("addressTopbar", "Megenagna, Fiteh Building, Ground B2");
        defaults.put("addressFull", "Megenagna, Yeka Sub-city, Fiteh Building, Markos Market Center, "
                + "Ground B2, Addis Ababa");
        defaults.put("addressFooter", "Fiteh Building, Ground B2, Markos Market Center, Megenagna, Addis Ababa");
        defaults.put("phone1", "0912159265");
        defaults.put("phone2", "0919117325");
        defaults.put("hoursWeekday", "Mon–Sat 8:30–20:00");
        defaults.put("hoursSunday", "Sun 9:00–19:00");
        defaults.put("contactTitle", "Come see the phones in person.");
        defaults.put("contactLead", "We are on the ground floor of Fiteh Building at Markos Market Center, "
                + "Megenagna — a short walk from the Megenagna roundabout.");
        defaults.put("footerAbout", "Original products, trusted service, and fast delivery from Megenagna, Addis Ababa.");
        DEFAULTS = java.util.Collections.unmodifiableMap(defaults);

        Map<String, Integer> limits = new LinkedHashMap<>();
        limits.put("tagline", 80);
        limits.put("heroEyebrow", 80);
        limits.put("heroLine1", 70);
        limits.put("heroLine2", 70);
        limits.put("heroAccent", 70);
        limits.put("heroLead", 400);
        limits.put("addressTopbar", 120);
        limits.put("addressFull", 250);
        limits.put("addressFooter", 180);
        limits.put("phone1", 20);
        limits.put("phone2", 20);
        limits.put("hoursWeekday", 60);
        limits.put("hoursSunday", 60);
        limits.put("contactTitle", 120);
        limits.put("contactLead", 400);
        limits.put("footerAbout", 300);
        LIMITS = java.util.Collections.unmodifiableMap(limits);
    }

    private final SiteSettingRepository repository;

    public SettingsService(SiteSettingRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Map<String, String> all() {
        Map<String, String> merged = new LinkedHashMap<>(DEFAULTS);
        for (SiteSetting row : repository.findAll()) {
            if (merged.containsKey(row.getKey())) {
                merged.put(row.getKey(), row.getValue());
            }
        }
        return merged;
    }

    @Transactional(readOnly = true)
    public Map<String, String> defaults() {
        return new LinkedHashMap<>(DEFAULTS);
    }

    @Transactional
    public Map<String, String> update(Map<String, String> changes) {
        if (changes == null || changes.isEmpty()) {
            throw ApiException.badRequest("Send at least one setting to update.");
        }
        for (Map.Entry<String, String> entry : changes.entrySet()) {
            String key = entry.getKey();
            if (!DEFAULTS.containsKey(key)) {
                throw ApiException.badRequest("Unknown setting: " + key);
            }
            String value = entry.getValue() == null ? "" : entry.getValue().trim();
            if (value.isEmpty()) {
                // Empty means "put the default back".
                repository.findById(key).ifPresent(repository::delete);
                continue;
            }
            int limit = LIMITS.getOrDefault(key, 400);
            if (value.length() > limit) {
                throw ApiException.badRequest(label(key) + " must be " + limit + " characters or fewer.");
            }
            if (key.startsWith("phone")) {
                String digits = value.replaceAll("[^0-9+]", "");
                if (digits.replace("+", "").length() < 7 || digits.length() > 16) {
                    throw ApiException.badRequest(label(key) + " must be a valid phone number.");
                }
                value = digits;
            }
            repository.save(new SiteSetting(key, value));
        }
        return all();
    }

    @Transactional
    public Map<String, String> reset() {
        repository.deleteAll();
        return all();
    }

    private static String label(String key) {
        return switch (key) {
            case "tagline" -> "Tagline";
            case "heroEyebrow" -> "Hero eyebrow";
            case "heroLine1" -> "Hero line 1";
            case "heroLine2" -> "Hero line 2";
            case "heroAccent" -> "Hero accent line";
            case "heroLead" -> "Hero paragraph";
            case "addressTopbar" -> "Top bar address";
            case "addressFull" -> "Full address";
            case "addressFooter" -> "Footer address";
            case "phone1" -> "Phone 1";
            case "phone2" -> "Phone 2";
            case "hoursWeekday" -> "Weekday hours";
            case "hoursSunday" -> "Sunday hours";
            case "contactTitle" -> "Contact heading";
            case "contactLead" -> "Contact paragraph";
            case "footerAbout" -> "Footer text";
            default -> key;
        };
    }
}
