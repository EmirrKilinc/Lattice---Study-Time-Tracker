package com.studytracker.dto.response;

import java.time.LocalDateTime;

public class StudySessionResponseDTO {

    private Long id;
    private Long topicId;
    private String topicName;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Long durationSeconds;

    public StudySessionResponseDTO() {}

    public StudySessionResponseDTO(Long id, Long topicId, String topicName,
                                   LocalDateTime startTime, LocalDateTime endTime,
                                   Long durationSeconds) {
        this.id = id;
        this.topicId = topicId;
        this.topicName = topicName;
        this.startTime = startTime;
        this.endTime = endTime;
        this.durationSeconds = durationSeconds;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getTopicId() { return topicId; }
    public void setTopicId(Long topicId) { this.topicId = topicId; }

    public String getTopicName() { return topicName; }
    public void setTopicName(String topicName) { this.topicName = topicName; }

    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }

    public LocalDateTime getEndTime() { return endTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }

    public Long getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(Long durationSeconds) { this.durationSeconds = durationSeconds; }
}
