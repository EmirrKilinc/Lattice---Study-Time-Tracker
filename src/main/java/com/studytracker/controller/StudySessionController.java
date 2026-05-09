package com.studytracker.controller;

import com.studytracker.dto.request.CreateStudySessionRequest;
import com.studytracker.dto.response.ChartDataResponseDTO;
import com.studytracker.dto.response.StudySessionResponseDTO;
import com.studytracker.security.SecurityUtils;
import com.studytracker.service.StudySessionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sessions")
public class StudySessionController {

    private final StudySessionService sessionService;

    public StudySessionController(StudySessionService sessionService) {
        this.sessionService = sessionService;
    }

    @GetMapping
    public ResponseEntity<List<StudySessionResponseDTO>> getSessions(
            @RequestParam(required = false) Long topicId,
            Authentication auth) {
        String sub = SecurityUtils.getOwnerSub(auth);
        if (topicId != null) {
            return ResponseEntity.ok(sessionService.getSessionsByTopic(topicId, sub));
        }
        return ResponseEntity.ok(sessionService.getAllSessions(sub));
    }

    @PostMapping
    public ResponseEntity<StudySessionResponseDTO> createSession(
            @Valid @RequestBody CreateStudySessionRequest req,
            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(sessionService.createSession(req, SecurityUtils.getOwnerSub(auth)));
    }

    @GetMapping("/today-total")
    public ResponseEntity<Map<String, Long>> getTodayTotal(Authentication auth) {
        return ResponseEntity.ok(Map.of("totalSeconds", sessionService.getTodayTotal(SecurityUtils.getOwnerSub(auth))));
    }

    @GetMapping("/chart/weekly")
    public ResponseEntity<ChartDataResponseDTO> getWeeklyChart(
            @RequestParam(required = false) Long courseId,
            Authentication auth) {
        return ResponseEntity.ok(sessionService.getWeeklyChartData(courseId, SecurityUtils.getOwnerSub(auth)));
    }

    @GetMapping("/chart/monthly")
    public ResponseEntity<ChartDataResponseDTO> getMonthlyChart(
            @RequestParam(required = false) Long courseId,
            Authentication auth) {
        return ResponseEntity.ok(sessionService.getMonthlyChartData(courseId, SecurityUtils.getOwnerSub(auth)));
    }

    @GetMapping("/chart/yearly")
    public ResponseEntity<ChartDataResponseDTO> getYearlyChart(
            @RequestParam(required = false) Long courseId,
            Authentication auth) {
        return ResponseEntity.ok(sessionService.getYearlyChartData(courseId, SecurityUtils.getOwnerSub(auth)));
    }
}
