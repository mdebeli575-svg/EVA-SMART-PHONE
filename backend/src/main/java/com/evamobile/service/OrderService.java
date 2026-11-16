package com.evamobile.service;

import com.evamobile.domain.Order;
import com.evamobile.domain.OrderItem;
import com.evamobile.domain.OrderStatus;
import com.evamobile.domain.PaymentMethod;
import com.evamobile.domain.Product;
import com.evamobile.dto.AdminStats;
import com.evamobile.dto.CheckoutRequest;
import com.evamobile.dto.OrderResponse;
import com.evamobile.repo.OrderRepository;
import com.evamobile.repo.ProductRepository;
import com.evamobile.service.payment.PaymentGateway;
import com.evamobile.service.payment.PaymentService;
import com.evamobile.web.ApiException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class OrderService {

    private static final char[] REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Set<OrderStatus> REVENUE_STATUSES = EnumSet.of(OrderStatus.PAID, OrderStatus.DELIVERED);
    private static final Set<OrderStatus> STOCK_RELEASING_STATUSES = EnumSet.of(OrderStatus.FAILED, OrderStatus.CANCELLED);

    private final OrderRepository orders;
    private final ProductRepository products;
    private final PaymentService payments;

    public OrderService(OrderRepository orders, ProductRepository products, PaymentService payments) {
        this.orders = orders;
        this.products = products;
        this.payments = payments;
    }

    @Transactional
    public OrderResponse create(CheckoutRequest request) {
        PaymentMethod method = parseMethod(request.paymentMethod());

        Order order = new Order();
        order.setReference(nextReference());
        order.setCustomerName(request.customerName().trim());
        order.setCustomerPhone(request.customerPhone().trim());
        order.setDeliveryAddress(request.deliveryAddress().trim());
        order.setNote(blankToNull(request.note()));
        order.setPaymentMethod(method);
        order.setStatus(OrderStatus.PENDING_PAYMENT);

        BigDecimal total = BigDecimal.ZERO;
        // Merge duplicate lines so stock checks stay correct.
        Map<Long, Integer> quantities = new LinkedHashMap<>();
        for (CheckoutRequest.CheckoutItem item : request.items()) {
            quantities.merge(item.productId(), item.quantity(), Integer::sum);
        }

        for (Map.Entry<Long, Integer> entry : quantities.entrySet()) {
            Product product = products.findById(entry.getKey())
                    .orElseThrow(() -> ApiException.badRequest("A product in your cart is no longer available."));
            if (!product.isActive()) {
                throw ApiException.badRequest(product.getName() + " is no longer available.");
            }
            int quantity = entry.getValue();
            if (quantity > 10) {
                throw ApiException.badRequest("Maximum 10 units per product.");
            }
            if (product.getStock() < quantity) {
                throw ApiException.conflict(product.getStock() == 0
                        ? product.getName() + " is out of stock."
                        : "Only " + product.getStock() + " x " + product.getName() + " left in stock.");
            }
            if (quantity <= 0) {
                throw ApiException.badRequest("Quantity must be at least 1.");
            }

            product.setStock(product.getStock() - quantity);

            BigDecimal lineTotal = product.getPrice().multiply(BigDecimal.valueOf(quantity));
            OrderItem orderItem = new OrderItem();
            orderItem.setProductId(product.getId());
            orderItem.setProductName(product.getName());
            orderItem.setUnitPrice(product.getPrice());
            orderItem.setQuantity(quantity);
            orderItem.setLineTotal(lineTotal);
            order.addItem(orderItem);

            total = total.add(lineTotal);
        }

        order.setTotalAmount(total);
        // Reject absurd carts early; the DB column is 12,2.
        if (total.compareTo(new BigDecimal("9999999999.99")) > 0) {
            throw ApiException.badRequest("Order total is too large. Please contact the store.");
        }
        orders.save(order);

        PaymentGateway.PaymentInitiation initiation = payments.initiate(order);
        return OrderResponse.from(order, initiation.paymentUrl());
    }

    @Transactional(readOnly = true)
    public OrderResponse findByReference(String reference) {
        return OrderResponse.from(requireOrder(reference), null);
    }

    /**
     * Called by the sandbox payment page after the customer "pays". Idempotent:
     * replaying a confirmation never double-changes stock or state.
     */
    @Transactional
    public OrderResponse confirmPayment(String reference, String outcome, String providerTxnId) {
        Order order = requireOrder(reference);
        if (order.getStatus() != OrderStatus.PENDING_PAYMENT) {
            return OrderResponse.from(order, null);
        }

        if ("SUCCESS".equalsIgnoreCase(outcome)) {
            order.setStatus(OrderStatus.PAID);
            order.setPaidAt(LocalDateTime.now());
            order.setProviderTxnId(providerTxnId == null || providerTxnId.isBlank()
                    ? "SANDBOX-" + reference
                    : providerTxnId.trim());
            order.setFailureReason(null);
        } else {
            order.setStatus(OrderStatus.FAILED);
            order.setFailureReason("Payment was not completed.");
            releaseStock(order);
        }
        return OrderResponse.from(order, null);
    }

    @Transactional(readOnly = true)
    public Page<OrderResponse> list(OrderStatus status, int page, int size) {
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        Page<Order> result = status == null
                ? orders.findAllByOrderByCreatedAtDesc(pageable)
                : orders.findByStatusOrderByCreatedAtDesc(status, pageable);
        return result.map(o -> OrderResponse.from(o, null));
    }

    @Transactional(readOnly = true)
    public AdminStats stats() {
        return new AdminStats(
                orders.count(),
                orders.countByStatus(OrderStatus.PENDING_PAYMENT),
                orders.countByStatus(OrderStatus.PAID),
                orders.countByCreatedAtAfter(LocalDate.now().atStartOfDay()),
                orders.sumRevenue(REVENUE_STATUSES)
        );
    }

    @Transactional
    public OrderResponse updateStatus(String reference, String rawStatus) {
        Order order = requireOrder(reference);
        OrderStatus target;
        try {
            target = OrderStatus.valueOf(rawStatus.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Unknown order status: " + rawStatus);
        }

        if (order.getStatus() == target) {
            return OrderResponse.from(order, null);
        }
        if (!isAllowedTransition(order.getStatus(), target)) {
            throw ApiException.conflict("Cannot move an order from " + order.getStatus() + " to " + target + ".");
        }

        if (target == OrderStatus.PAID && order.getPaidAt() == null) {
            order.setPaidAt(LocalDateTime.now());
            order.setFailureReason(null);
        }
        if (STOCK_RELEASING_STATUSES.contains(target)) {
            releaseStock(order);
        }
        order.setStatus(target);
        return OrderResponse.from(order, null);
    }

    private boolean isAllowedTransition(OrderStatus from, OrderStatus to) {
        return switch (from) {
            case PENDING_PAYMENT -> EnumSet.of(OrderStatus.PAID, OrderStatus.FAILED,
                    OrderStatus.CANCELLED, OrderStatus.DELIVERED).contains(to);
            case PAID -> EnumSet.of(OrderStatus.DELIVERED, OrderStatus.CANCELLED).contains(to);
            case FAILED, CANCELLED -> false;
            case DELIVERED -> false;
        };
    }

    private void releaseStock(Order order) {
        for (OrderItem item : order.getItems()) {
            products.findById(item.getProductId()).ifPresent(product ->
                    product.setStock(product.getStock() + item.getQuantity()));
        }
    }

    private Order requireOrder(String reference) {
        return orders.findByReference(reference)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "No order found with reference " + reference + "."));
    }

    private PaymentMethod parseMethod(String raw) {
        if (raw == null) {
            throw ApiException.badRequest("Choose a payment method.");
        }
        try {
            return PaymentMethod.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Unsupported payment method. Use TELEBIRR or CBE.");
        }
    }

    private String nextReference() {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder sb = new StringBuilder("EVA-");
            for (int i = 0; i < 6; i++) {
                sb.append(REFERENCE_ALPHABET[RANDOM.nextInt(REFERENCE_ALPHABET.length)]);
            }
            String candidate = sb.toString();
            if (!orders.existsByReference(candidate)) {
                return candidate;
            }
        }
        throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not allocate an order reference.");
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public List<String> statuses() {
        return java.util.Arrays.stream(OrderStatus.values()).map(Enum::name).toList();
    }
}
