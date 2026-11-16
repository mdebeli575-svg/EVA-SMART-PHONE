package com.evamobile.repo;

import com.evamobile.domain.CallbackRequest;
import com.evamobile.domain.CallbackStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;

public interface CallbackRequestRepository extends JpaRepository<CallbackRequest, Long> {

    boolean existsByReference(String reference);

    boolean existsByPhoneAndCreatedAtAfter(String phone, LocalDateTime moment);

    Page<CallbackRequest> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<CallbackRequest> findByStatusOrderByCreatedAtDesc(CallbackStatus status, Pageable pageable);

    long countByStatus(CallbackStatus status);
}
