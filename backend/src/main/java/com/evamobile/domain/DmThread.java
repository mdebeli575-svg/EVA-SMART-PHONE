package com.evamobile.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "dm_threads", indexes = {
        @Index(name = "idx_dm_thread_code", columnList = "threadCode", unique = true),
        @Index(name = "idx_dm_thread_updated", columnList = "updatedAt"),
        @Index(name = "idx_dm_thread_status", columnList = "status")
})
public class DmThread {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 24)
    private String threadCode;

    @Column(nullable = false, length = 80)
    private String customerName;

    @Column(nullable = false, length = 24)
    private String customerPhone;

    @Column(length = 120)
    private String subject;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DmStatus status = DmStatus.OPEN;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Column(nullable = false)
    private LocalDateTime lastMessageAt;

    @Column(nullable = false)
    private boolean unreadForAdmin = true;

    @Column(nullable = false)
    private boolean unreadForCustomer = false;

    @OneToMany(mappedBy = "thread", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<DmMessage> messages = new ArrayList<>();

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (lastMessageAt == null) lastMessageAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void addMessage(DmMessage message) {
        messages.add(message);
        message.setThread(this);
        lastMessageAt = message.getCreatedAt() != null ? message.getCreatedAt() : LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getThreadCode() { return threadCode; }
    public void setThreadCode(String threadCode) { this.threadCode = threadCode; }
    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    public String getCustomerPhone() { return customerPhone; }
    public void setCustomerPhone(String customerPhone) { this.customerPhone = customerPhone; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public DmStatus getStatus() { return status; }
    public void setStatus(DmStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public LocalDateTime getLastMessageAt() { return lastMessageAt; }
    public void setLastMessageAt(LocalDateTime lastMessageAt) { this.lastMessageAt = lastMessageAt; }
    public boolean isUnreadForAdmin() { return unreadForAdmin; }
    public void setUnreadForAdmin(boolean unreadForAdmin) { this.unreadForAdmin = unreadForAdmin; }
    public boolean isUnreadForCustomer() { return unreadForCustomer; }
    public void setUnreadForCustomer(boolean unreadForCustomer) { this.unreadForCustomer = unreadForCustomer; }
    public List<DmMessage> getMessages() { return messages; }
}