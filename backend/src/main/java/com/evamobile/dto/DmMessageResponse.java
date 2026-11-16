package com.evamobile.dto;

import com.evamobile.domain.DmMessage;

import java.time.LocalDateTime;

public record DmMessageResponse(
        Long id,
        String sender,
        String body,
        LocalDateTime createdAt
) {
    public static DmMessageResponse from(DmMessage message) {
        return new DmMessageResponse(
                message.getId(),
                message.getSender().name(),
                message.getBody(),
                message.getCreatedAt()
        );
    }
}