package com.evamobile.service;

import com.evamobile.domain.CallbackRequest;
import com.evamobile.domain.CallbackStatus;
import com.evamobile.dto.CallbackCreateRequest;
import com.evamobile.dto.CallbackResponse;
import com.evamobile.dto.CallbackStats;
import com.evamobile.repo.CallbackRequestRepository;
import com.evamobile.web.ApiException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.regex.Pattern;

/** Queue of "call me back" requests submitted from the public call-center page. */
@Service
public class CallbackService {

    private static final String[] ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".split("");
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Pattern ETHIOPIAN_PHONE = Pattern.compile("^(\\+251|0)9\\d{8}$");
    /** Stops double-taps and accidental duplicate submissions. */
    private static final long DUPLICATE_WINDOW_MINUTES = 2;

    private final CallbackRequestRepository callbacks;

    public CallbackService(CallbackRequestRepository callbacks) {
        this.callbacks = callbacks;
    }

    @Transactional
    public CallbackResponse create(CallbackCreateRequest request) {
        String phone = normalizePhone(request.phone());
        if (!ETHIOPIAN_PHONE.matcher(phone).matches()) {
            throw ApiException.badRequest("Enter a valid Ethiopian phone number, e.g. 0912159265");
        }
        if (callbacks.existsByPhoneAndCreatedAtAfter(phone, LocalDateTime.now().minusMinutes(DUPLICATE_WINDOW_MINUTES))) {
            throw ApiException.badRequest(
                    "We already have a callback request for this number. Please give us a few minutes to call you.");
        }

        CallbackRequest callback = new CallbackRequest();
        callback.setReference(nextReference());
        callback.setName(request.name().trim());
        callback.setPhone(phone);
        callback.setTopic(request.topic().trim());
        callback.setPreferredTime(blankToNull(request.preferredTime()));
        callback.setNote(blankToNull(request.note()));
        callback.setStatus(CallbackStatus.NEW);
        return CallbackResponse.from(callbacks.save(callback));
    }

    @Transactional(readOnly = true)
    public Page<CallbackResponse> list(CallbackStatus status, int page, int size) {
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        Page<CallbackRequest> result = status == null
                ? callbacks.findAllByOrderByCreatedAtDesc(pageable)
                : callbacks.findByStatusOrderByCreatedAtDesc(status, pageable);
        return result.map(CallbackResponse::from);
    }

    @Transactional(readOnly = true)
    public CallbackStats stats() {
        return new CallbackStats(
                callbacks.count(),
                callbacks.countByStatus(CallbackStatus.NEW),
                callbacks.countByStatus(CallbackStatus.CONTACTED),
                callbacks.countByStatus(CallbackStatus.CLOSED)
        );
    }

    @Transactional
    public CallbackResponse updateStatus(Long id, String rawStatus) {
        CallbackStatus status;
        try {
            status = CallbackStatus.valueOf(rawStatus.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException | NullPointerException e) {
            throw ApiException.badRequest("Unknown callback status. Use NEW, CONTACTED or CLOSED.");
        }
        CallbackRequest callback = require(id);
        callback.setStatus(status);
        return CallbackResponse.from(callbacks.save(callback));
    }

    @Transactional
    public void delete(Long id) {
        callbacks.delete(require(id));
    }

    private CallbackRequest require(Long id) {
        return callbacks.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "No callback request found with id " + id + "."));
    }

    private String normalizePhone(String raw) {
        String digits = raw == null ? "" : raw.replaceAll("[^0-9+]", "");
        if (digits.startsWith("251")) {
            digits = "+" + digits;
        }
        return digits;
    }

    private String nextReference() {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder sb = new StringBuilder("CB-");
            for (int i = 0; i < 6; i++) {
                sb.append(ALPHABET[RANDOM.nextInt(ALPHABET.length)]);
            }
            String candidate = sb.toString();
            if (!callbacks.existsByReference(candidate)) {
                return candidate;
            }
        }
        throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not allocate a callback reference.");
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
