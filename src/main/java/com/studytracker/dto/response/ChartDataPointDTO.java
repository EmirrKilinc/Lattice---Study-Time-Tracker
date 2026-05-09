package com.studytracker.dto.response;

public class ChartDataPointDTO {

    /** ISO date string – "yyyy-MM-dd" for weekly/monthly, "yyyy-MM" for yearly */
    private String date;
    private Long courseId;
    private Long totalSeconds;

    public ChartDataPointDTO() {}

    public ChartDataPointDTO(String date, Long courseId, Long totalSeconds) {
        this.date = date;
        this.courseId = courseId;
        this.totalSeconds = totalSeconds;
    }

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }

    public Long getCourseId() { return courseId; }
    public void setCourseId(Long courseId) { this.courseId = courseId; }

    public Long getTotalSeconds() { return totalSeconds; }
    public void setTotalSeconds(Long totalSeconds) { this.totalSeconds = totalSeconds; }
}
