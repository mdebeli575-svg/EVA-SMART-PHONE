package com.evamobile.web;

import com.evamobile.dto.ProductDto;
import com.evamobile.service.ProductService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping("/products")
    public List<ProductDto> products(@RequestParam(required = false) String category,
                                     @RequestParam(required = false) String q) {
        return productService.list(category, q);
    }

    @GetMapping("/products/{id}")
    public ProductDto product(@PathVariable Long id) {
        return productService.get(id);
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("status", "UP", "service", "eva-mobile-api", "time", LocalDateTime.now().toString());
    }
}
