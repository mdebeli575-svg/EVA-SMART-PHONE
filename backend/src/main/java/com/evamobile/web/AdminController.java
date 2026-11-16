package com.evamobile.web;

import com.evamobile.domain.CallbackStatus;
import com.evamobile.domain.OrderStatus;
import com.evamobile.dto.AdminProductDto;
import com.evamobile.dto.AdminStats;
import com.evamobile.dto.CallbackResponse;
import com.evamobile.dto.CallbackStats;
import com.evamobile.dto.OrderResponse;
import com.evamobile.dto.ProductRequest;
import com.evamobile.service.CallbackService;
import com.evamobile.service.DmService;
import com.evamobile.service.OrderService;
import com.evamobile.service.ProductService;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final OrderService orderService;
    private final ProductService productService;
    private final CallbackService callbackService;
    private final DmService dmService;

    public AdminController(OrderService orderService, ProductService productService, CallbackService callbackService, DmService dmService) {
        this.orderService = orderService;
        this.productService = productService;
        this.callbackService = callbackService;
        this.dmService = dmService;
    }

    public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {
    }

    @GetMapping("/orders")
    public PageResponse<OrderResponse> orders(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {

        OrderStatus parsed = null;
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            try {
                parsed = OrderStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw ApiException.badRequest("Unknown status filter: " + status);
            }
        }
        Page<OrderResponse> result = orderService.list(parsed, page, size);
        return new PageResponse<>(result.getContent(), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    @GetMapping("/stats")
    public AdminStats stats() {
        return orderService.stats();
    }

    @GetMapping("/statuses")
    public List<String> statuses() {
        return Arrays.stream(OrderStatus.values()).map(Enum::name).toList();
    }

    @PatchMapping("/orders/{reference}/status")
    public OrderResponse updateStatus(@PathVariable String reference, @RequestBody Map<String, String> body) {
        String status = body.get("status");
        if (status == null || status.isBlank()) {
            throw ApiException.badRequest("Body must contain a status field.");
        }
        return orderService.updateStatus(reference, status);
    }

    // ------------------------------- products -------------------------------

    @GetMapping("/products")
    public List<AdminProductDto> products(@RequestParam(required = false) String q) {
        return productService.listAll(q);
    }

    @PostMapping("/products")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminProductDto createProduct(@RequestBody ProductRequest request) {
        return productService.create(request);
    }

    @PutMapping("/products/{id}")
    public AdminProductDto updateProduct(@PathVariable Long id, @RequestBody ProductRequest request) {
        return productService.update(id, request);
    }

    @PatchMapping("/products/{id}/visibility")
    public AdminProductDto setVisibility(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        Boolean active = body.get("active");
        if (active == null) {
            throw ApiException.badRequest("Body must contain an active (true/false) field.");
        }
        return productService.setActive(id, active);
    }

    @PostMapping(value = "/products/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AdminProductDto uploadImage(@PathVariable Long id, @RequestParam("file") MultipartFile file) {
        return productService.uploadImage(id, file);
    }

    @DeleteMapping("/products/{id}")
    public Map<String, Object> deleteProduct(@PathVariable Long id) {
        productService.delete(id);
        return Map.of("deleted", true, "id", id);
    }

    // ------------------------------- callbacks -------------------------------

    @GetMapping("/callbacks")
    public PageResponse<CallbackResponse> callbacks(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {

        CallbackStatus parsed = null;
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            try {
                parsed = CallbackStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw ApiException.badRequest("Unknown callback status filter: " + status);
            }
        }
        Page<CallbackResponse> result = callbackService.list(parsed, page, size);
        return new PageResponse<>(result.getContent(), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    @GetMapping("/callbacks/stats")
    public CallbackStats callbackStats() {
        return callbackService.stats();
    }

    @PatchMapping("/callbacks/{id}/status")
    public CallbackResponse updateCallbackStatus(@PathVariable Long id,
                                                 @RequestBody Map<String, String> body) {
        String status = body.get("status");
        if (status == null || status.isBlank()) {
            throw ApiException.badRequest("Body must contain a status field.");
        }
        return callbackService.updateStatus(id, status);
    }

    @DeleteMapping("/callbacks/{id}")
    public Map<String, Object> deleteCallback(@PathVariable Long id) {
        callbackService.delete(id);
        return Map.of("deleted", true, "id", id);
    }

    // ------------------------------- direct messages -------------------------------

    @GetMapping("/messages")
    public PageResponse<com.evamobile.dto.DmThreadResponse> messages(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        Page<com.evamobile.dto.DmThreadResponse> result = dmService.listForAdmin(status, page, size);
        return new PageResponse<>(result.getContent(), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    @GetMapping("/messages/unread-count")
    public Map<String, Object> unreadMessages() {
        return Map.of("count", dmService.unreadForAdmin());
    }

    @GetMapping("/messages/{threadCode}")
    public com.evamobile.dto.DmThreadResponse messageThread(@PathVariable String threadCode) {
        return dmService.getThreadForAdmin(threadCode);
    }

    @PostMapping("/messages/{threadCode}/reply")
    public com.evamobile.dto.DmThreadResponse replyMessage(@PathVariable String threadCode,
                                                           @RequestBody com.evamobile.dto.DmMessageCreateRequest request) {
        return dmService.adminReply(threadCode, request);
    }

    @PatchMapping("/messages/{threadCode}/status")
    public com.evamobile.dto.DmThreadResponse updateMessageStatus(@PathVariable String threadCode,
                                                                  @RequestBody Map<String, String> body) {
        String status = body.get("status");
        if (status == null || status.isBlank()) {
            throw ApiException.badRequest("Body must contain a status field.");
        }
        return dmService.updateStatus(threadCode, status);
    }
}
