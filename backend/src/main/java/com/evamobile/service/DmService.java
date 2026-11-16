package com.evamobile.service;

import com.evamobile.domain.DmMessage;
import com.evamobile.domain.DmSender;
import com.evamobile.domain.DmStatus;
import com.evamobile.domain.DmThread;
import com.evamobile.dto.DmMessageCreateRequest;
import com.evamobile.dto.DmThreadCreateRequest;
import com.evamobile.dto.DmThreadResponse;
import com.evamobile.repo.DmThreadRepository;
import com.evamobile.web.ApiException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Locale;

@Service
public class DmService {

    private static final String[] ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".split("");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final DmThreadRepository threads;

    public DmService(DmThreadRepository threads) {
        this.threads = threads;
    }

    @Transactional
    public DmThreadResponse createThread(DmThreadCreateRequest request) {
        String phone = normalizePhone(request.phone());
        DmThread thread = new DmThread();
        thread.setThreadCode(nextCode());
        thread.setCustomerName(request.name().trim());
        thread.setCustomerPhone(phone);
        thread.setSubject(blankToNull(request.subject()));
        thread.setStatus(DmStatus.OPEN);
        thread.setUnreadForAdmin(true);
        thread.setUnreadForCustomer(false);

        DmMessage message = new DmMessage();
        message.setSender(DmSender.CUSTOMER);
        message.setBody(request.message().trim());
        message.setCreatedAt(LocalDateTime.now());
        thread.addMessage(message);
        thread.setLastMessageAt(message.getCreatedAt());
        return DmThreadResponse.from(threads.save(thread), true);
    }

    @Transactional(readOnly = true)
    public DmThreadResponse getThreadForCustomer(String threadCode, String phone) {
        DmThread thread = requireByCode(threadCode);
        assertCustomerAccess(thread, phone);
        return DmThreadResponse.from(thread, true);
    }

    @Transactional
    public DmThreadResponse customerReply(String threadCode, String phone, DmMessageCreateRequest request) {
        DmThread thread = requireByCode(threadCode);
        assertCustomerAccess(thread, phone);
        if (thread.getStatus() == DmStatus.CLOSED) {
            throw ApiException.conflict("This conversation is closed. Please start a new message.");
        }
        DmMessage message = new DmMessage();
        message.setSender(DmSender.CUSTOMER);
        message.setBody(request.message().trim());
        message.setCreatedAt(LocalDateTime.now());
        thread.addMessage(message);
        thread.setUnreadForAdmin(true);
        thread.setUnreadForCustomer(false);
        return DmThreadResponse.from(threads.save(thread), true);
    }

    @Transactional(readOnly = true)
    public Page<DmThreadResponse> listForAdmin(String status, int page, int size) {
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        Page<DmThread> result;
        if (status == null || status.isBlank() || "ALL".equalsIgnoreCase(status)) {
            result = threads.findAllByOrderByLastMessageAtDesc(pageable);
        } else {
            DmStatus parsed;
            try {
                parsed = DmStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw ApiException.badRequest("Unknown message status filter: " + status);
            }
            result = threads.findByStatusOrderByLastMessageAtDesc(parsed, pageable);
        }
        return result.map(t -> DmThreadResponse.from(t, false));
    }

    @Transactional
    public DmThreadResponse getThreadForAdmin(String threadCode) {
        DmThread thread = requireByCode(threadCode);
        thread.setUnreadForAdmin(false);
        return DmThreadResponse.from(threads.save(thread), true);
    }

    @Transactional
    public DmThreadResponse adminReply(String threadCode, DmMessageCreateRequest request) {
        DmThread thread = requireByCode(threadCode);
        DmMessage message = new DmMessage();
        message.setSender(DmSender.ADMIN);
        message.setBody(request.message().trim());
        message.setCreatedAt(LocalDateTime.now());
        thread.addMessage(message);
        thread.setUnreadForCustomer(true);
        thread.setUnreadForAdmin(false);
        if (thread.getStatus() == DmStatus.CLOSED) {
            thread.setStatus(DmStatus.OPEN);
        }
        return DmThreadResponse.from(threads.save(thread), true);
    }

    @Transactional
    public DmThreadResponse updateStatus(String threadCode, String rawStatus) {
        DmThread thread = requireByCode(threadCode);
        try {
            thread.setStatus(DmStatus.valueOf(rawStatus.trim().toUpperCase(Locale.ROOT)));
        } catch (Exception e) {
            throw ApiException.badRequest("Unknown status. Use OPEN or CLOSED.");
        }
        return DmThreadResponse.from(threads.save(thread), true);
    }

    @Transactional(readOnly = true)
    public long unreadForAdmin() {
        return threads.countByUnreadForAdminTrue();
    }

    private void assertCustomerAccess(DmThread thread, String phone) {
        String normalized = normalizePhone(phone);
        if (!thread.getCustomerPhone().equals(normalized)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Conversation not found.");
        }
    }

    private DmThread requireByCode(String threadCode) {
        return threads.findByThreadCode(threadCode)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Conversation not found."));
    }

    private String normalizePhone(String raw) {
        String digits = raw == null ? "" : raw.replaceAll("[^0-9+]", "");
        if (digits.startsWith("251")) digits = "+" + digits;
        return digits;
    }

    private String nextCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder sb = new StringBuilder("DM-");
            for (int i = 0; i < 6; i++) sb.append(ALPHABET[RANDOM.nextInt(ALPHABET.length)]);
            String candidate = sb.toString();
            if (!threads.existsByThreadCode(candidate)) return candidate;
        }
        throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not allocate a message code.");
    }

    private String blankToNull(String value) {
        if (value == null) return null;
        String t = value.trim();
        return t.isEmpty() ? null : t;
    }
}