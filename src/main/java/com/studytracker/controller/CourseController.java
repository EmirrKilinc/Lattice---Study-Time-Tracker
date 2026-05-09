package com.studytracker.controller;

import com.studytracker.dto.request.CreateCourseRequest;
import com.studytracker.dto.request.UpdateCourseRequest;
import com.studytracker.dto.response.CourseTotalTimeDTO;
import com.studytracker.dto.response.CourseResponseDTO;
import com.studytracker.security.SecurityUtils;
import com.studytracker.service.CourseService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/courses")
public class CourseController {

    private final CourseService courseService;

    public CourseController(CourseService courseService) {
        this.courseService = courseService;
    }

    @GetMapping
    public ResponseEntity<List<CourseResponseDTO>> getAllCourses(Authentication auth) {
        return ResponseEntity.ok(courseService.getAllCourses(SecurityUtils.getOwnerSub(auth)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CourseResponseDTO> getCourseById(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(courseService.getCourseById(id, SecurityUtils.getOwnerSub(auth)));
    }

    @PostMapping
    public ResponseEntity<CourseResponseDTO> createCourse(@Valid @RequestBody CreateCourseRequest req,
                                                          Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(courseService.createCourse(req, SecurityUtils.getOwnerSub(auth)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CourseResponseDTO> updateCourse(@PathVariable Long id,
                                                          @Valid @RequestBody UpdateCourseRequest req,
                                                          Authentication auth) {
        return ResponseEntity.ok(courseService.updateCourse(id, req, SecurityUtils.getOwnerSub(auth)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCourse(@PathVariable Long id, Authentication auth) {
        courseService.deleteCourse(id, SecurityUtils.getOwnerSub(auth));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/total-time")
    public ResponseEntity<CourseTotalTimeDTO> getCourseTotalTime(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(courseService.getCourseTotalTime(id, SecurityUtils.getOwnerSub(auth)));
    }
}
