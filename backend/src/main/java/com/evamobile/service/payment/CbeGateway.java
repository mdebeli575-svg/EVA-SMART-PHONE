package com.evamobile.service.payment;

import com.evamobile.domain.Order;
import com.evamobile.domain.PaymentMethod;
import com.evamobile.web.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * CBE Birr merchant gateway skeleton.
 *
 * <p>Enable with {@code eva.payments.mode=live} and fill
 * {@code eva.payments.cbe.*}. The real flow is:</p>
 * <ol>
 *   <li>POST the merchant checkout request (MerchantID, Amount, ReferenceNumber,
 *       callback/return URLs) to the CBE merchant endpoint.</li>
 *   <li>Receive a session / payment URL and redirect the customer there.</li>
 *   <li>CBE calls {@code /api/payments/cbe/callback} server-to-server. Verify the
 *       transaction with the CBE API before marking the order PAID.</li>
 * </ol>
 */
@Component
@ConditionalOnProperty(name = "eva.payments.mode", havingValue = "live")
public class CbeGateway implements PaymentGateway {

    private final String merchantId;
    private final String merchantKey;
    private final String baseUrl;

    public CbeGateway(
            @Value("${eva.payments.cbe.merchant-id:}") String merchantId,
            @Value("${eva.payments.cbe.merchant-key:}") String merchantKey,
            @Value("${eva.payments.cbe.base-url:}") String baseUrl) {
        this.merchantId = merchantId;
        this.merchantKey = merchantKey;
        this.baseUrl = baseUrl;
    }

    @Override
    public PaymentMethod method() {
        return PaymentMethod.CBE;
    }

    @Override
    public PaymentInitiation initiate(Order order) {
        if (merchantId.isBlank() || merchantKey.isBlank() || baseUrl.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "CBE Birr is not configured yet. Set eva.payments.cbe.* in application.properties.");
        }
        throw new ApiException(HttpStatus.NOT_IMPLEMENTED,
                "CBE Birr live handshake is not enabled in this build. Use eva.payments.mode=sandbox.");
    }
}
