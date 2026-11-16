package com.evamobile.dto;

import com.evamobile.domain.Order;
import com.evamobile.domain.OrderItem;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record OrderResponse(
        String reference,
        String status,
        String paymentMethod,
        BigDecimal totalAmount,
        String customerName,
        String customerPhone,
        String deliveryAddress,
        String note,
        LocalDateTime createdAt,
        LocalDateTime paidAt,
        List<Item> items,
        String paymentUrl,
        String failureReason
) {
    public record Item(
            Long productId,
            String productName,
            BigDecimal unitPrice,
            int quantity,
            BigDecimal lineTotal
    ) {
        static Item from(OrderItem i) {
            return new Item(i.getProductId(), i.getProductName(), i.getUnitPrice(), i.getQuantity(), i.getLineTotal());
        }
    }

    public static OrderResponse from(Order o, String paymentUrl) {
        return new OrderResponse(
                o.getReference(),
                o.getStatus().name(),
                o.getPaymentMethod().name(),
                o.getTotalAmount(),
                o.getCustomerName(),
                o.getCustomerPhone(),
                o.getDeliveryAddress(),
                o.getNote(),
                o.getCreatedAt(),
                o.getPaidAt(),
                o.getItems().stream().map(Item::from).toList(),
                paymentUrl,
                o.getFailureReason()
        );
    }
}
