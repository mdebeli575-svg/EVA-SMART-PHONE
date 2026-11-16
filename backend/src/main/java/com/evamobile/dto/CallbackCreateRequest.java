package com.evamobile.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** What the call-center page posts when a customer asks for a callback. */
public record CallbackCreateRequest(

        @NotBlank(message = "Please enter your name")
        @Size(min = 2, max = 80, message = "Name must be between 2 and 80 characters")
        String name,

        @NotBlank(message = "Phone number is required")
        @Size(min = 7, max = 24, message = "Enter a valid Ethiopian phone number, e.g. 0912159265")
        String phone,

        @NotBlank(message = "Choose what the call is about")
        @Size(max = 80, message = "Topic must be 80 characters or fewer")
        String topic,

        @Size(max = 60, message = "Preferred time must be 60 characters or fewer")
        String preferredTime,

        @Size(max = 500, message = "Note must be 500 characters or fewer")
        String note
) {
}
