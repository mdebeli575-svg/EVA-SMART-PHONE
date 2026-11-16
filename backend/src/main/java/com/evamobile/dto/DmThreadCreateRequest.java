package com.evamobile.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DmThreadCreateRequest(
        @NotBlank(message = "Please enter your name")
        @Size(min = 2, max = 80, message = "Name must be between 2 and 80 characters")
        String name,

        @NotBlank(message = "Phone number is required")
        @Size(min = 7, max = 24, message = "Enter a valid phone number")
        String phone,

        @Size(max = 120, message = "Subject must be 120 characters or fewer")
        String subject,

        @NotBlank(message = "Message is required")
        @Size(min = 1, max = 1000, message = "Message must be 1000 characters or fewer")
        String message
) {
}