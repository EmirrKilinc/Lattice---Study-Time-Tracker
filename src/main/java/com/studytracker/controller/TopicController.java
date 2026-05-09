package com.studytracker.controller;

import com.studytracker.dto.request.CreateTopicRequest;
import com.studytracker.dto.request.UpdateNotesRequest;
import com.studytracker.dto.request.UpdateTopicRequest;
import com.studytracker.dto.response.TopicResponseDTO;
import com.studytracker.security.SecurityUtils;
import com.studytracker.service.TopicService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/topics")
public class TopicController {

    private final TopicService topicService;

    public TopicController(TopicService topicService) {
        this.topicService = topicService;
    }

    @GetMapping
    public ResponseEntity<List<TopicResponseDTO>> getTopics(@RequestParam(required = false) Long courseId,
                                                            Authentication auth) {
        String sub = SecurityUtils.getOwnerSub(auth);
        if (courseId != null) {
            return ResponseEntity.ok(topicService.getTopicsByCourse(courseId, sub));
        }
        return ResponseEntity.ok(topicService.getAllTopics(sub));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TopicResponseDTO> getTopicById(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(topicService.getTopicById(id, SecurityUtils.getOwnerSub(auth)));
    }

    @PostMapping
    public ResponseEntity<TopicResponseDTO> createTopic(@Valid @RequestBody CreateTopicRequest req,
                                                        Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(topicService.createTopic(req, SecurityUtils.getOwnerSub(auth)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TopicResponseDTO> updateTopic(@PathVariable Long id,
                                                        @Valid @RequestBody UpdateTopicRequest req,
                                                        Authentication auth) {
        return ResponseEntity.ok(topicService.updateTopic(id, req, SecurityUtils.getOwnerSub(auth)));
    }

    @PatchMapping("/{id}/notes")
    public ResponseEntity<TopicResponseDTO> updateNotes(@PathVariable Long id,
                                                        @RequestBody UpdateNotesRequest req,
                                                        Authentication auth) {
        return ResponseEntity.ok(topicService.updateNotes(id, req, SecurityUtils.getOwnerSub(auth)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTopic(@PathVariable Long id, Authentication auth) {
        topicService.deleteTopic(id, SecurityUtils.getOwnerSub(auth));
        return ResponseEntity.noContent().build();
    }
}
