package com.evamobile.dto;

import com.evamobile.domain.Product;

import java.math.BigDecimal;

public record ProductDto(
        Long id,
        String name,
        String brand,
        String category,
        BigDecimal price,
        int stock,
        String description,
        String color,
        boolean featured,
        String imageUrl
) {
    public static ProductDto from(Product p) {
        return new ProductDto(
                p.getId(),
                p.getName(),
                p.getBrand(),
                p.getCategory().name(),
                p.getPrice(),
                p.getStock(),
                p.getDescription(),
                p.getColor(),
                p.isFeatured(),
                p.getImageUrl()
        );
    }
}
