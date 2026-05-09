package com.studytracker.dto.response;

import java.time.LocalDateTime;

public class TopicResponseDTO {

    private Long id;
    private Long courseId;
    private String courseName;
    private String name;
    private String notes;
    private LocalDateTime createdAt;
    private Long totalSeconds;
    private String lastStudied;

    public TopicResponseDTO() {}

    public TopicResponseDTO(Long id, Long courseId, String courseName,
                            String name, String notes, LocalDateTime createdAt,
                            Long totalSeconds, String lastStudied) {
        this.id = id;
        this.courseId = courseId;
        this.courseName = courseName;
        this.name = name;
        this.notes = notes;
        this.createdAt = createdAt;
        this.totalSeconds = totalSeconds;
        this.lastStudied = lastStudied;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getCourseId() { return courseId; }
    public void setCourseId(Long courseId) { this.courseId = courseId; }

    public String getCourseName() { return courseName; }
    public void setCourseName(String courseName) { this.courseName = courseName; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public Long getTotalSeconds() { return totalSeconds; }
    public void setTotalSeconds(Long totalSeconds) { this.totalSeconds = totalSeconds; }

    public String getLastStudied() { return lastStudied; }
    public void setLastStudied(String lastStudied) { this.lastStudied = lastStudied; }
}
