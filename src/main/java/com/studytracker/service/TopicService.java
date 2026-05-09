package com.studytracker.service;

import com.studytracker.dto.request.CreateTopicRequest;
import com.studytracker.dto.request.UpdateNotesRequest;
import com.studytracker.dto.request.UpdateTopicRequest;
import com.studytracker.dto.response.TopicResponseDTO;
import com.studytracker.entity.Course;
import com.studytracker.entity.Topic;
import com.studytracker.exception.ResourceNotFoundException;
import com.studytracker.repository.CourseRepository;
import com.studytracker.repository.StudySessionRepository;
import com.studytracker.repository.TopicRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Transactional
public class TopicService {

    private final TopicRepository topicRepository;
    private final CourseRepository courseRepository;
    private final StudySessionRepository sessionRepository;

    public TopicService(TopicRepository topicRepository, CourseRepository courseRepository,
                        StudySessionRepository sessionRepository) {
        this.topicRepository = topicRepository;
        this.courseRepository = courseRepository;
        this.sessionRepository = sessionRepository;
    }

    @Transactional(readOnly = true)
    public List<TopicResponseDTO> getAllTopics(String ownerSub) {
        return topicRepository.findAllByOwnerSub(ownerSub)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TopicResponseDTO> getTopicsByCourse(Long courseId, String ownerSub) {
        if (!courseRepository.existsByIdAndOwnerSub(courseId, ownerSub)) {
            throw new ResourceNotFoundException("Course", "id", courseId);
        }
        return topicRepository.findByCourseIdAndOwnerSub(courseId, ownerSub)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public TopicResponseDTO getTopicById(Long id, String ownerSub) {
        return toDTO(findOrThrow(id, ownerSub));
    }

    public TopicResponseDTO createTopic(CreateTopicRequest req, String ownerSub) {
        Course course = courseRepository.findByIdAndOwnerSub(req.getCourseId(), ownerSub)
                .orElseThrow(() -> new ResourceNotFoundException("Course", "id", req.getCourseId()));

        Topic topic = new Topic();
        topic.setCourse(course);
        topic.setName(req.getName());
        topic.setNotes(req.getNotes());

        return toDTO(topicRepository.save(topic));
    }

    public TopicResponseDTO updateTopic(Long id, UpdateTopicRequest req, String ownerSub) {
        Topic topic = findOrThrow(id, ownerSub);
        topic.setName(req.getName());
        if (req.getNotes() != null) {
            topic.setNotes(req.getNotes());
        }
        return toDTO(topicRepository.save(topic));
    }

    public TopicResponseDTO updateNotes(Long id, UpdateNotesRequest req, String ownerSub) {
        Topic topic = findOrThrow(id, ownerSub);
        topic.setNotes(req.getNotes());
        return toDTO(topicRepository.save(topic));
    }

    public void deleteTopic(Long id, String ownerSub) {
        if (!topicRepository.existsByIdAndOwnerSub(id, ownerSub)) {
            throw new ResourceNotFoundException("Topic", "id", id);
        }
        topicRepository.deleteById(id);
    }

    private Topic findOrThrow(Long id, String ownerSub) {
        return topicRepository.findByIdAndOwnerSub(id, ownerSub)
                .orElseThrow(() -> new ResourceNotFoundException("Topic", "id", id));
    }

    private TopicResponseDTO toDTO(Topic t) {
        Long totalSeconds = sessionRepository.sumDurationByTopicId(t.getId());
        Optional<LocalDateTime> lastSession = sessionRepository.findLastSessionEndTimeByTopicId(t.getId());
        String lastStudied = lastSession.map(dt -> dt.toLocalDate().toString()).orElse(null);

        return new TopicResponseDTO(
                t.getId(),
                t.getCourse().getId(),
                t.getCourse().getName(),
                t.getName(),
                t.getNotes(),
                t.getCreatedAt(),
                totalSeconds != null ? totalSeconds : 0L,
                lastStudied
        );
    }
}
