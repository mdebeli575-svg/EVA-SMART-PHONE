package com.evamobile.service.payment;

import com.evamobile.domain.Order;
import com.evamobile.domain.PaymentMethod;
import com.evamobile.web.ApiException;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Service
public class PaymentService {

    private final Map<PaymentMethod, PaymentGateway> gateways = new EnumMap<>(PaymentMethod.class);

    public PaymentService(List<PaymentGateway> gatewayBeans) {
        for (PaymentGateway gateway : gatewayBeans) {
            if (gateway instanceof SandboxPaymentGateway sandbox) {
                for (PaymentMethod method : PaymentMethod.values()) {
                    if (sandbox.supports(method)) {
                        gateways.put(method, sandbox);
                    }
                }
            } else if (gateway.method() != null) {
                gateways.put(gateway.method(), gateway);
            }
        }
    }

    public PaymentGateway.PaymentInitiation initiate(Order order) {
        PaymentGateway gateway = gateways.get(order.getPaymentMethod());
        if (gateway == null) {
            throw new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                    "No payment gateway is available for " + order.getPaymentMethod());
        }
        return gateway.initiate(order);
    }
}
