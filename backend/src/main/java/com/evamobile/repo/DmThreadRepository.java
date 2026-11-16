package com.evamobile.repo;

import com.evamobile.domain.DmStatus;
import com.evamobile.domain.DmThread;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DmThreadRepository extends JpaRepository<DmThread, Long> {
    Optional<DmThread> findByThreadCode(String threadCode);
    boolean existsByThreadCode(String threadCode);
    Page<DmThread> findAllByOrderByLastMessageAtDesc(Pageable pageable);
    Page<DmThread> findByStatusOrderByLastMessageAtDesc(DmStatus status, Pageable pageable);
    long countByUnreadForAdminTrue();
}