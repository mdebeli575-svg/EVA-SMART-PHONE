package com.evamobile.web;

import com.evamobile.dto.OrderResponse;
import com.evamobile.dto.PaymentConfirmRequest;
import com.evamobile.service.OrderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private static final Logger log = LoggerFactory.getLogger(PaymentController.class);

    private final OrderService orderService;

    public PaymentController(OrderService orderService) {
        this.orderService = orderService;
    }

    /**
     * Sandbox only: the local checkout page reports the simulated result.
     * Disabled when eva.payments.mode=live (see SecurityConfig note in README).
     */
    @PostMapping("/{reference}/confirm")
    public OrderResponse confirm(@PathVariable String reference,
                                 @RequestBody(required = false) PaymentConfirmRequest request) {
        String outcome = request == null ? "SUCCESS" : request.outcome();
        String txnId = request == null ? null : request.providerTxnId();
        return orderService.confirmPayment(reference, outcome, txnId);
    }

    /**
     * Telebirr server-to-server notification. Must verify the RSA signature of
     * the payload before trusting it - never mark an order paid on raw input.
     */
    @PostMapping("/telebirr/callback")
    public Map<String, String> telebirrCallback(@RequestBody(required = false) Map<String, Object> payload) {
        log.info("Telebirr callback received: {}", payload);
        // TODO verify signature + decrypt, look up outTradeNo, then:
        // orderService.confirmPayment(reference, "SUCCESS", providerTxnId);
        return Map.of("code", "0", "msg", "success");
    }

    /** CBE Birr server-to-server notification (same verification rules apply). */
    @PostMapping("/cbe/callback")
    public Map<String, String> cbeCallback(@RequestBody(required = false) Map<String, Object> payload) {
        log.info("CBE callback received: {}", payload);
        return Map.of("status", "OK");
    }
}
