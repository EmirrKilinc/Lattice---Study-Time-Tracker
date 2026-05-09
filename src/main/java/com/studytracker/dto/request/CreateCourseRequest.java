package com.studytracker.dto.request;

import jakarta.validation.constraints.NotBlank;

public class CreateCourseRequest {

    @NotBlank(message = "Course name is required")
    private String name;

    private String code;

    public CreateCourseRequest() {}

    public CreateCourseRequest(String name, String code) {
        this.name = name;
        this.code = code;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
}
