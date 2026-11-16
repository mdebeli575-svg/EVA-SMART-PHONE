package com.evamobile.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DmMessageCreateRequest(
        @NotBlank(message = "Message is required")
        @Size(min = 1, max = 1000, message = "Message must be 1000 characters or fewer")
        String message
) {
}