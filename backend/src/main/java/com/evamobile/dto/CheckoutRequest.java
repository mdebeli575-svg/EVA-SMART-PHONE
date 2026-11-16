package com.evamobile.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CheckoutRequest(

        @NotBlank(message = "Please enter your full name")
        @Size(min = 2, max = 80, message = "Name must be between 2 and 80 characters")
        String customerName,

        @NotBlank(message = "Phone number is required")
        @Pattern(regexp = "^(\\+251|0)9\\d{8}$", message = "Enter a valid Ethiopian phone number, e.g. 0912159265")
        String customerPhone,

        @NotBlank(message = "Delivery address is required")
        @Size(min = 5, max = 250, message = "Address must be between 5 and 250 characters")
        String deliveryAddress,

        @Size(max = 250, message = "Note is too long")
        String note,

        @NotNull(message = "Choose a payment method")
        String paymentMethod,

        @NotEmpty(message = "Your cart is empty")
        @Size(max = 20, message = "Too many items in one order")
        List<@Valid CheckoutItem> items
) {
    public record CheckoutItem(
            @NotNull(message = "Product is required")
            Long productId,

            @Min(value = 1, message = "Quantity must be at least 1")
            @Max(value = 10, message = "Maximum 10 units per product")
            int quantity
    ) {
    }
}
