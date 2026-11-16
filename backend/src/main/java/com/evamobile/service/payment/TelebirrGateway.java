package com.evamobile.service.payment;

import com.evamobile.domain.Order;
import com.evamobile.domain.PaymentMethod;
import com.evamobile.web.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Telebirr H5 (Fabric) gateway skeleton.
 *
 * <p>Enable with {@code eva.payments.mode=live} and fill the
 * {@code eva.payments.telebirr.*} properties. The real flow is:</p>
 * <ol>
 *   <li>POST /apiaccess/token with App ID + App Key -> bearer token.</li>
 *   <li>Build the Fabric "apply" payload: appId, shortCode, nonce, outTradeNo,
 *       totalAmount, subject, returnUrl, notifyUrl, timeoutExpress.</li>
 *   <li>Sign the payload fields with the merchant private key (RSA-SHA256) and
 *       encrypt the signed payload with Telebirr's public key.</li>
 *   <li>POST /payment/v1/merchant/preOrder -> {@code toPayUrl}.</li>
 *   <li>Send the customer to {@code toPayUrl}. Telebirr calls notifyUrl
 *       server-to-server; verify the signature there before trusting it.</li>
 * </ol>
 *
 * <p>No network call is made until credentials are configured, so accidentally
 * switching to live mode fails loudly instead of creating unpaid orders.</p>
 */
@Component
@ConditionalOnProperty(name = "eva.payments.mode", havingValue = "live")
public class TelebirrGateway implements PaymentGateway {

    private final String appId;
    private final String appKey;
    private final String shortCode;

    public TelebirrGateway(
            @Value("${eva.payments.telebirr.app-id:}") String appId,
            @Value("${eva.payments.telebirr.app-key:}") String appKey,
            @Value("${eva.payments.telebirr.short-code:}") String shortCode) {
        this.appId = appId;
        this.appKey = appKey;
        this.shortCode = shortCode;
    }

    @Override
    public PaymentMethod method() {
        return PaymentMethod.TELEBIRR;
    }

    @Override
    public PaymentInitiation initiate(Order order) {
        if (appId.isBlank() || appKey.isBlank() || shortCode.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Telebirr is not configured yet. Set eva.payments.telebirr.* in application.properties.");
        }
        throw new ApiException(HttpStatus.NOT_IMPLEMENTED,
                "Telebirr live handshake is not enabled in this build. Use eva.payments.mode=sandbox.");
    }
}
