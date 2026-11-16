package com.evamobile.dto;

/** Queue sizes for the call-center dashboard. */
public record CallbackStats(long total, long newCount, long contacted, long closed) {
}
