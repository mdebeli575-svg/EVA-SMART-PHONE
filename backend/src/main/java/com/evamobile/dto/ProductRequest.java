package com.evamobile.dto;

import java.math.BigDecimal;

/**
 * Payload the staff dashboard sends when creating or editing a product.
 * Field types are boxed so a missing value can be told apart from zero/false.
 */
public record ProductRequest(
        String name,
        String brand,
        String category,
        BigDecimal price,
        Integer stock,
        String description,
        String color,
        Boolean featured,
        Boolean active,
        String imageUrl
) {
}
