package com.evamobile.web;

import com.evamobile.service.SettingsService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class SettingsController {

    private final SettingsService settings;

    public SettingsController(SettingsService settings) {
        this.settings = settings;
    }

    /** Public: the storefront reads this to fill in text on load. */
    @GetMapping("/api/settings")
    public Map<String, String> publicSettings() {
        return settings.all();
    }

    @GetMapping("/api/admin/settings")
    public Map<String, String> adminSettings() {
        return settings.all();
    }

    @GetMapping("/api/admin/settings/defaults")
    public Map<String, String> defaults() {
        return settings.defaults();
    }

    /** Partial update: keys you send are changed, omitted keys left alone. */
    @PutMapping("/api/admin/settings")
    public Map<String, String> update(@RequestBody Map<String, String> changes) {
        return settings.update(changes);
    }

    @DeleteMapping("/api/admin/settings")
    public Map<String, String> reset() {
        return settings.reset();
    }
}
