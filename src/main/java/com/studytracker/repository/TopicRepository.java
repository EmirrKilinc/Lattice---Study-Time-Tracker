package com.studytracker.repository;

import com.studytracker.entity.Topic;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TopicRepository extends JpaRepository<Topic, Long> {

    List<Topic> findByCourseId(Long courseId);

    @Query("SELECT t FROM Topic t WHERE t.course.ownerSub = :ownerSub")
    List<Topic> findAllByOwnerSub(@Param("ownerSub") String ownerSub);

    @Query("SELECT t FROM Topic t WHERE t.course.id = :courseId AND t.course.ownerSub = :ownerSub")
    List<Topic> findByCourseIdAndOwnerSub(@Param("courseId") Long courseId, @Param("ownerSub") String ownerSub);

    @Query("SELECT t FROM Topic t WHERE t.id = :id AND t.course.ownerSub = :ownerSub")
    Optional<Topic> findByIdAndOwnerSub(@Param("id") Long id, @Param("ownerSub") String ownerSub);

    @Query("SELECT COUNT(t) > 0 FROM Topic t WHERE t.id = :id AND t.course.ownerSub = :ownerSub")
    boolean existsByIdAndOwnerSub(@Param("id") Long id, @Param("ownerSub") String ownerSub);
}
