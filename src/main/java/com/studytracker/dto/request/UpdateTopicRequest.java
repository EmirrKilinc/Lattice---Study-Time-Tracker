package com.studytracker.dto.request;

import jakarta.validation.constraints.NotBlank;

public class UpdateTopicRequest {

    @NotBlank(message = "Topic name is required")
    private String name;

    private String notes;

    public UpdateTopicRequest() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
