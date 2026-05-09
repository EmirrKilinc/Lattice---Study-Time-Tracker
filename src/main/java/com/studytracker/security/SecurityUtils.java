package com.studytracker.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;

public class SecurityUtils {

    private SecurityUtils() {}

    /**
     * Returns a stable per-user identifier regardless of auth method:
     * - Google OAuth2  → Google's "sub" claim (numeric string)
     * - JWT (email/pw) → the user's email address
     */
    public static String getOwnerSub(Authentication auth) {
        if (auth.getPrincipal() instanceof OAuth2User oauth2User) {
            return oauth2User.getAttribute("sub");
        }
        return auth.getName(); // JWT: email set as principal name
    }
}
