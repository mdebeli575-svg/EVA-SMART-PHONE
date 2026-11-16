package com.evamobile.dto;

import java.math.BigDecimal;

public record AdminStats(
        long totalOrders,
        long pendingOrders,
        long paidOrders,
        long ordersToday,
        BigDecimal revenue
) {
}
