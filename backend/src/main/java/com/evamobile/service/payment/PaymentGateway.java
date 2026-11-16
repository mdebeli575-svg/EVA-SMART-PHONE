package com.evamobile.service.payment;

import com.evamobile.domain.Order;
import com.evamobile.domain.PaymentMethod;

/**
 * One implementation per payment provider. The order service never talks to a
 * provider directly, so swapping sandbox for production is a matter of
 * enabling the matching Spring bean.
 */
public interface PaymentGateway {

    PaymentMethod method();

    PaymentInitiation initiate(Order order);

    /**
     * @param paymentUrl URL the browser must be sent to (absolute, or relative to the storefront)
     * @param providerReference provider-side reference, when the provider assigns one up front
     */
    record PaymentInitiation(String paymentUrl, String providerReference) {
    }
}
