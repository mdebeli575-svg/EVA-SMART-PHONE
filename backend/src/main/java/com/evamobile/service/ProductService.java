package com.evamobile.service;

import com.evamobile.domain.Category;
import com.evamobile.domain.Product;
import com.evamobile.dto.AdminProductDto;
import com.evamobile.dto.ProductDto;
import com.evamobile.dto.ProductRequest;
import com.evamobile.repo.ProductRepository;
import com.evamobile.web.ApiException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
public class ProductService {

    private static final Pattern HEX_COLOR = Pattern.compile("^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$");
    private static final String DEFAULT_COLOR = "#2f6fed";
    private static final BigDecimal MAX_PRICE = new BigDecimal("9999999");

    private final ProductRepository products;
    private final ImageStorageService imageStorage;

    public ProductService(ProductRepository products, ImageStorageService imageStorage) {
        this.products = products;
        this.imageStorage = imageStorage;
    }

    @Transactional(readOnly = true)
    public List<ProductDto> list(String category, String search) {
        List<Product> result;
        if (search != null && !search.isBlank()) {
            result = products.search(search.trim());
        } else if (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) {
            Category parsed;
            try {
                parsed = Category.valueOf(category.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw ApiException.badRequest("Unknown category: " + category);
            }
            result = products.findByActiveTrueAndCategoryOrderByFeaturedDescNameAsc(parsed);
        } else {
            result = products.findByActiveTrueOrderByFeaturedDescNameAsc();
        }
        return result.stream().map(ProductDto::from).toList();
    }

    @Transactional(readOnly = true)
    public ProductDto get(Long id) {
        return products.findById(id)
                .filter(Product::isActive)
                .map(ProductDto::from)
                .orElseThrow(() -> ApiException.notFound("Product not found."));
    }

    // ----------------------------- staff dashboard -----------------------------

    @Transactional(readOnly = true)
    public List<AdminProductDto> listAll(String search) {
        List<Product> result = products.findAll(Sort.by(Sort.Direction.ASC, "id"));
        if (search != null && !search.isBlank()) {
            String needle = search.trim().toLowerCase(Locale.ROOT);
            result = result.stream()
                    .filter(p -> p.getName().toLowerCase(Locale.ROOT).contains(needle)
                            || p.getBrand().toLowerCase(Locale.ROOT).contains(needle))
                    .toList();
        }
        return result.stream().map(AdminProductDto::from).toList();
    }

    @Transactional
    public AdminProductDto create(ProductRequest request) {
        Product product = new Product();
        apply(product, request);
        return AdminProductDto.from(products.save(product));
    }

    @Transactional
    public AdminProductDto update(Long id, ProductRequest request) {
        Product product = require(id);
        apply(product, request);
        return AdminProductDto.from(products.save(product));
    }

    @Transactional
    public AdminProductDto setActive(Long id, boolean active) {
        Product product = require(id);
        product.setActive(active);
        return AdminProductDto.from(products.save(product));
    }

    @Transactional
    public AdminProductDto uploadImage(Long id, MultipartFile file) {
        Product product = require(id);
        String previous = product.getImageUrl();
        String stored = imageStorage.storeProductImage(id, file);
        product.setImageUrl(stored);
        products.save(product);
        if (previous != null && !previous.equals(stored)) {
            imageStorage.deleteQuietly(previous);
        }
        return AdminProductDto.from(product);
    }

    @Transactional
    public void delete(Long id) {
        Product product = require(id);
        String image = product.getImageUrl();
        products.delete(product);
        imageStorage.deleteQuietly(image);
    }

    private Product require(Long id) {
        return products.findById(id)
                .orElseThrow(() -> ApiException.notFound("Product " + id + " was not found."));
    }

    private void apply(Product target, ProductRequest request) {
        if (request == null) {
            throw ApiException.badRequest("Product details are missing.");
        }

        String name = trim(request.name());
        if (name.isEmpty()) throw ApiException.badRequest("Product name is required.");
        if (name.length() > 120) throw ApiException.badRequest("Product name must be 120 characters or fewer.");

        String brand = trim(request.brand());
        if (brand.isEmpty()) throw ApiException.badRequest("Brand is required.");
        if (brand.length() > 60) throw ApiException.badRequest("Brand must be 60 characters or fewer.");

        Category category;
        try {
            category = Category.valueOf(trim(request.category()).toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Category must be SMARTPHONE or ACCESSORY.");
        }

        if (request.price() == null) throw ApiException.badRequest("Price is required.");
        BigDecimal price = request.price().setScale(2, RoundingMode.HALF_UP);
        if (price.signum() < 0) throw ApiException.badRequest("Price cannot be negative.");
        if (price.compareTo(MAX_PRICE) > 0) throw ApiException.badRequest("Price looks too high. Check the amount.");

        int stock = request.stock() == null ? 0 : request.stock();
        if (stock < 0) throw ApiException.badRequest("Stock cannot be negative.");
        if (stock > 1_000_000) throw ApiException.badRequest("Stock looks too high.");

        String description = trimToNull(request.description());
        if (description != null && description.length() > 600) {
            throw ApiException.badRequest("Description must be 600 characters or fewer.");
        }

        String color = trim(request.color());
        if (color.isEmpty()) {
            color = DEFAULT_COLOR;
        }
        if (!HEX_COLOR.matcher(color).matches()) {
            throw ApiException.badRequest("Colour must be a hex value such as #2f6fed.");
        }

        String imageUrl = trimToNull(request.imageUrl());
        if (imageUrl != null && !imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")
                && !imageUrl.startsWith("/uploads/")) {
            throw ApiException.badRequest("Image must be an uploaded file or an http(s) link.");
        }
        if (imageUrl != null && imageUrl.length() > 255) {
            throw ApiException.badRequest("Image link is too long.");
        }

        target.setName(name);
        target.setBrand(brand);
        target.setCategory(category);
        target.setPrice(price);
        target.setStock(stock);
        target.setDescription(description);
        target.setColor(color);
        target.setFeatured(Boolean.TRUE.equals(request.featured()));
        target.setActive(request.active() == null || request.active());
        target.setImageUrl(imageUrl);
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private static String trimToNull(String value) {
        String trimmed = trim(value);
        return trimmed.isEmpty() ? null : trimmed;
    }
}
