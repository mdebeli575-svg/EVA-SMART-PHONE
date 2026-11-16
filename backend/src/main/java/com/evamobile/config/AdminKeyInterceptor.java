package com.evamobile.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Lightweight gate for the admin API. The storefront admin page asks the owner
 * for the key and sends it as X-Admin-Key. For multi-user production use,
 * replace this with Spring Security (form login + roles).
 */
@Component
public class AdminKeyInterceptor implements HandlerInterceptor {

    private final byte[] adminKey;

    public AdminKeyInterceptor(@Value("${eva.admin.key}") String adminKey) {
        this.adminKey = adminKey.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        // CORS preflight must pass through untouched.
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String provided = request.getHeader("X-Admin-Key");
        if (provided == null || !MessageDigest.isEqual(provided.getBytes(StandardCharsets.UTF_8), adminKey)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write("{\"error\":\"UNAUTHORIZED\",\"message\":\"Valid X-Admin-Key header required.\"}");
            return false;
        }
        return true;
    }
}
