package com.studytracker.service;

import com.studytracker.dto.request.CreateStudySessionRequest;
import com.studytracker.dto.response.ChartDataPointDTO;
import com.studytracker.dto.response.ChartDataResponseDTO;
import com.studytracker.dto.response.StudySessionResponseDTO;
import com.studytracker.entity.StudySession;
import com.studytracker.entity.Topic;
import com.studytracker.exception.ResourceNotFoundException;
import com.studytracker.repository.StudySessionRepository;
import com.studytracker.repository.TopicRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class StudySessionService {

    private final StudySessionRepository sessionRepository;
    private final TopicRepository topicRepository;

    public StudySessionService(StudySessionRepository sessionRepository,
                               TopicRepository topicRepository) {
        this.sessionRepository = sessionRepository;
        this.topicRepository = topicRepository;
    }

    @Transactional(readOnly = true)
    public List<StudySessionResponseDTO> getAllSessions(String ownerSub) {
        return sessionRepository.findAllByOwnerSub(ownerSub)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<StudySessionResponseDTO> getSessionsByTopic(Long topicId, String ownerSub) {
        if (!topicRepository.existsByIdAndOwnerSub(topicId, ownerSub)) {
            throw new ResourceNotFoundException("Topic", "id", topicId);
        }
        return sessionRepository.findByTopicId(topicId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public StudySessionResponseDTO createSession(CreateStudySessionRequest req, String ownerSub) {
        Topic topic = topicRepository.findByIdAndOwnerSub(req.getTopicId(), ownerSub)
                .orElseThrow(() -> new ResourceNotFoundException("Topic", "id", req.getTopicId()));

        if (!req.getEndTime().isAfter(req.getStartTime())) {
            throw new IllegalArgumentException("endTime must be strictly after startTime");
        }

        long durationSeconds = ChronoUnit.SECONDS.between(req.getStartTime(), req.getEndTime());

        StudySession session = new StudySession();
        session.setTopic(topic);
        session.setStartTime(req.getStartTime());
        session.setEndTime(req.getEndTime());
        session.setDurationSeconds(durationSeconds);

        return toDTO(sessionRepository.save(session));
    }

    @Transactional(readOnly = true)
    public ChartDataResponseDTO getWeeklyChartData(Long courseId, String ownerSub) {
        LocalDateTime startDate = LocalDateTime.now().minusDays(7).toLocalDate().atStartOfDay();

        List<Object[]> rows = (courseId != null)
                ? sessionRepository.findChartDataByCourseIdSince(startDate, courseId, ownerSub)
                : sessionRepository.findChartDataSince(startDate, ownerSub);

        return buildResponse("weekly", rows);
    }

    @Transactional(readOnly = true)
    public ChartDataResponseDTO getMonthlyChartData(Long courseId, String ownerSub) {
        LocalDateTime startDate = LocalDateTime.now().withDayOfMonth(1).toLocalDate().atStartOfDay();

        List<Object[]> rows = (courseId != null)
                ? sessionRepository.findChartDataByCourseIdSince(startDate, courseId, ownerSub)
                : sessionRepository.findChartDataSince(startDate, ownerSub);

        return buildResponse("monthly", rows);
    }

    @Transactional(readOnly = true)
    public ChartDataResponseDTO getYearlyChartData(Long courseId, String ownerSub) {
        int year = LocalDateTime.now().getYear();

        List<Object[]> rows = (courseId != null)
                ? sessionRepository.findYearlyChartDataByCourse(year, courseId, ownerSub)
                : sessionRepository.findYearlyChartData(year, ownerSub);

        return buildResponse("yearly", rows);
    }

    @Transactional(readOnly = true)
    public Long getTodayTotal(String ownerSub) {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay   = startOfDay.plusDays(1);
        Long total = sessionRepository.sumTodayTotal(startOfDay, endOfDay, ownerSub);
        return total != null ? total : 0L;
    }

    private ChartDataResponseDTO buildResponse(String period, List<Object[]> rows) {
        List<ChartDataPointDTO> points = rows.stream()
                .map(row -> new ChartDataPointDTO(
                        row[0].toString(),
                        ((Number) row[1]).longValue(),
                        ((Number) row[2]).longValue()
                ))
                .collect(Collectors.toList());
        return new ChartDataResponseDTO(period, points);
    }

    private StudySessionResponseDTO toDTO(StudySession s) {
        return new StudySessionResponseDTO(
                s.getId(),
                s.getTopic().getId(),
                s.getTopic().getName(),
                s.getStartTime(),
                s.getEndTime(),
                s.getDurationSeconds()
        );
    }
}
