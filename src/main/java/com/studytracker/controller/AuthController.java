package com.studytracker.controller;

import com.studytracker.entity.AppUser;
import com.studytracker.repository.AppUserRepository;
import com.studytracker.security.JwtUtil;
import com.studytracker.security.SecurityUtils;
import com.studytracker.service.CourseService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final CourseService courseService;
    private final AppUserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    public AuthController(CourseService courseService,
                          AppUserRepository userRepository,
                          JwtUtil jwtUtil,
                          PasswordEncoder passwordEncoder) {
        this.courseService = courseService;
        this.userRepository = userRepository;
        this.jwtUtil = jwtUtil;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        Map<String, Object> info = new HashMap<>();
        if (auth.getPrincipal() instanceof OAuth2User oauth2User) {
            info.put("name",    oauth2User.getAttribute("name"));
            info.put("email",   oauth2User.getAttribute("email"));
            info.put("picture", oauth2User.getAttribute("picture"));
        } else {
            String email = auth.getName();
            AppUser user = userRepository.findByEmail(email).orElse(null);
            info.put("name",    user != null ? user.getName() : email);
            info.put("email",   email);
            info.put("picture", null);
        }
        return ResponseEntity.ok(info);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> req) {
        String email    = req.get("email");
        String password = req.get("password");
        String name     = req.get("name");

        if (email == null || email.isBlank() || !email.contains("@")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Valid email required"));
        }
        if (password == null || password.length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 6 characters"));
        }
        if (userRepository.existsByEmail(email)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email already registered"));
        }

        AppUser user = new AppUser();
        user.setEmail(email);
        user.setName(name != null && !name.isBlank() ? name : email.split("@")[0]);
        user.setPasswordHash(passwordEncoder.encode(password));
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("token", jwtUtil.generateToken(email)));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> req) {
        String email    = req.get("email");
        String password = req.get("password");

        AppUser user = userRepository.findByEmail(email).orElse(null);
        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid email or password"));
        }

        return ResponseEntity.ok(Map.of("token", jwtUtil.generateToken(email)));
    }

    @PostMapping("/claim")
    public ResponseEntity<?> claimOrphanedData(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        int claimed = courseService.claimOrphanedData(SecurityUtils.getOwnerSub(auth));
        return ResponseEntity.ok(Map.of("claimed", claimed));
    }
}
