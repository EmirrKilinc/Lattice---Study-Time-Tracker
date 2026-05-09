package com.studytracker.service;

import com.studytracker.dto.request.CreateCourseRequest;
import com.studytracker.dto.request.UpdateCourseRequest;
import com.studytracker.dto.response.CourseTotalTimeDTO;
import com.studytracker.dto.response.CourseResponseDTO;
import com.studytracker.entity.Course;
import com.studytracker.exception.ResourceNotFoundException;
import com.studytracker.repository.CourseRepository;
import com.studytracker.repository.StudySessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class CourseService {

    private final CourseRepository courseRepository;
    private final StudySessionRepository sessionRepository;

    public CourseService(CourseRepository courseRepository,
                         StudySessionRepository sessionRepository) {
        this.courseRepository = courseRepository;
        this.sessionRepository = sessionRepository;
    }

    @Transactional(readOnly = true)
    public List<CourseResponseDTO> getAllCourses(String ownerSub) {
        return courseRepository.findByOwnerSub(ownerSub)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CourseResponseDTO getCourseById(Long id, String ownerSub) {
        return toDTO(findOrThrow(id, ownerSub));
    }

    public CourseResponseDTO createCourse(CreateCourseRequest req, String ownerSub) {
        Course course = new Course();
        course.setName(req.getName());
        course.setCode(req.getCode());
        course.setOwnerSub(ownerSub);
        return toDTO(courseRepository.save(course));
    }

    public CourseResponseDTO updateCourse(Long id, UpdateCourseRequest req, String ownerSub) {
        Course course = findOrThrow(id, ownerSub);
        course.setName(req.getName());
        if (req.getCode() != null) {
            course.setCode(req.getCode());
        }
        return toDTO(courseRepository.save(course));
    }

    public void deleteCourse(Long id, String ownerSub) {
        if (!courseRepository.existsByIdAndOwnerSub(id, ownerSub)) {
            throw new ResourceNotFoundException("Course", "id", id);
        }
        courseRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public CourseTotalTimeDTO getCourseTotalTime(Long courseId, String ownerSub) {
        Course course = findOrThrow(courseId, ownerSub);
        Long total = sessionRepository.sumDurationByCourseId(courseId);
        return new CourseTotalTimeDTO(courseId, course.getName(), total != null ? total : 0L);
    }

    public int claimOrphanedData(String ownerSub) {
        return courseRepository.claimOrphanedCourses(ownerSub);
    }

    private Course findOrThrow(Long id, String ownerSub) {
        return courseRepository.findByIdAndOwnerSub(id, ownerSub)
                .orElseThrow(() -> new ResourceNotFoundException("Course", "id", id));
    }

    private CourseResponseDTO toDTO(Course c) {
        return new CourseResponseDTO(c.getId(), c.getName(), c.getCode(), c.getCreatedAt());
    }
}
