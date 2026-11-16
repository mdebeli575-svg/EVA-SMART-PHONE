package com.evamobile.dto;

import com.evamobile.domain.CallbackRequest;

import java.time.LocalDateTime;

public record CallbackResponse(
        Long id,
        String reference,
        String name,
        String phone,
        String topic,
        String preferredTime,
        String note,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static CallbackResponse from(CallbackRequest request) {
        return new CallbackResponse(
                request.getId(),
                request.getReference(),
                request.getName(),
                request.getPhone(),
                request.getTopic(),
                request.getPreferredTime(),
                request.getNote(),
                request.getStatus().name(),
                request.getCreatedAt(),
                request.getUpdatedAt()
        );
    }
}
