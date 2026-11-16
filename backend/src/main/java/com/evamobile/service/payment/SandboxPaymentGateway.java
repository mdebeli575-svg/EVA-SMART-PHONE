package com.evamobile.service.payment;

import com.evamobile.domain.Order;
import com.evamobile.domain.PaymentMethod;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Development / demo gateway. Sends the customer to a local checkout page that
 * imitates Telebirr and CBE Birr, so the full flow (order -> payment -> paid)
 * can be exercised without merchant credentials.
 */
@Component
@ConditionalOnProperty(name = "eva.payments.mode", havingValue = "sandbox", matchIfMissing = true)
public class SandboxPaymentGateway implements PaymentGateway {

    @Override
    public PaymentMethod method() {
        return null; // serves every method
    }

    @Override
    public PaymentInitiation initiate(Order order) {
        String url = "/pay.html?ref=" + order.getReference()
                + "&method=" + order.getPaymentMethod().name().toLowerCase();
        return new PaymentInitiation(url, "SANDBOX-" + order.getReference());
    }

    public boolean supports(PaymentMethod method) {
        return true;
    }
}
