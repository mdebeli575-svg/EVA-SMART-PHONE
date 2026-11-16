package com.evamobile.dto;

public record PaymentConfirmRequest(String outcome, String providerTxnId) {
}
