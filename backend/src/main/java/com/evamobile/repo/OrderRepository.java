package com.evamobile.repo;

import com.evamobile.domain.Order;
import com.evamobile.domain.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    @EntityGraph(attributePaths = "items")
    Optional<Order> findByReference(String reference);

    boolean existsByReference(String reference);

    // Items are fetched lazily in batches (@BatchSize) so LIMIT/OFFSET stays in SQL.
    Page<Order> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Order> findByStatusOrderByCreatedAtDesc(OrderStatus status, Pageable pageable);

    long countByStatus(OrderStatus status);

    long countByCreatedAtAfter(LocalDateTime moment);

    @Query("select coalesce(sum(o.totalAmount), 0) from Order o where o.status in :statuses")
    BigDecimal sumRevenue(@Param("statuses") java.util.Collection<OrderStatus> statuses);
}
