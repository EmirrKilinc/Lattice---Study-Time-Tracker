package com.studytracker.dto.response;

public class CourseTotalTimeDTO {

    private Long courseId;
    private String courseName;
    private Long totalSeconds;

    public CourseTotalTimeDTO() {}

    public CourseTotalTimeDTO(Long courseId, String courseName, Long totalSeconds) {
        this.courseId = courseId;
        this.courseName = courseName;
        this.totalSeconds = totalSeconds;
    }

    public Long getCourseId() { return courseId; }
    public void setCourseId(Long courseId) { this.courseId = courseId; }

    public String getCourseName() { return courseName; }
    public void setCourseName(String courseName) { this.courseName = courseName; }

    public Long getTotalSeconds() { return totalSeconds; }
    public void setTotalSeconds(Long totalSeconds) { this.totalSeconds = totalSeconds; }
}
