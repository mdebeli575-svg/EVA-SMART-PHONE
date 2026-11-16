package com.evamobile.repo;

import com.evamobile.domain.DmMessage;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DmMessageRepository extends JpaRepository<DmMessage, Long> {
}