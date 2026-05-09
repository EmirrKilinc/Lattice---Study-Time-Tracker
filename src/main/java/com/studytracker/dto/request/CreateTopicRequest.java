package com.studytracker.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class CreateTopicRequest {

    @NotNull(message = "Course ID is required")
    private Long courseId;

    @NotBlank(message = "Topic name is required")
    private String name;

    private String notes;

    public CreateTopicRequest() {}

    public Long getCourseId() { return courseId; }
    public void setCourseId(Long courseId) { this.courseId = courseId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
