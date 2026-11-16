package com.evamobile.dto;

import com.evamobile.domain.DmThread;

import java.time.LocalDateTime;
import java.util.List;

public record DmThreadResponse(
        Long id,
        String threadCode,
        String customerName,
        String customerPhone,
        String subject,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime lastMessageAt,
        boolean unreadForAdmin,
        boolean unreadForCustomer,
        List<DmMessageResponse> messages
) {
    public static DmThreadResponse from(DmThread thread, boolean includeMessages) {
        return new DmThreadResponse(
                thread.getId(),
                thread.getThreadCode(),
                thread.getCustomerName(),
                thread.getCustomerPhone(),
                thread.getSubject(),
                thread.getStatus().name(),
                thread.getCreatedAt(),
                thread.getUpdatedAt(),
                thread.getLastMessageAt(),
                thread.isUnreadForAdmin(),
                thread.isUnreadForCustomer(),
                includeMessages ? thread.getMessages().stream().map(DmMessageResponse::from).toList() : List.of()
        );
    }
}