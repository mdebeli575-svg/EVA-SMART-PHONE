package com.evamobile.dto;

import com.evamobile.domain.Product;

import java.math.BigDecimal;

/**
 * Product view for the staff dashboard: same as the storefront DTO plus the
 * {@code active} flag so hidden products can still be managed.
 */
public record AdminProductDto(
        Long id,
        String name,
        String brand,
        String category,
        BigDecimal price,
        int stock,
        String description,
        String color,
        boolean featured,
        boolean active,
        String imageUrl
) {
    public static AdminProductDto from(Product p) {
        return new AdminProductDto(
                p.getId(),
                p.getName(),
                p.getBrand(),
                p.getCategory().name(),
                p.getPrice(),
                p.getStock(),
                p.getDescription(),
                p.getColor(),
                p.isFeatured(),
                p.isActive(),
                p.getImageUrl()
        );
    }
}
