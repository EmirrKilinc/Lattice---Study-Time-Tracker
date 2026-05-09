package com.studytracker.repository;

import com.studytracker.entity.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourseRepository extends JpaRepository<Course, Long> {

    List<Course> findByOwnerSub(String ownerSub);

    Optional<Course> findByIdAndOwnerSub(Long id, String ownerSub);

    boolean existsByIdAndOwnerSub(Long id, String ownerSub);

    @Modifying
    @Query("UPDATE Course c SET c.ownerSub = :ownerSub WHERE c.ownerSub IS NULL")
    int claimOrphanedCourses(@Param("ownerSub") String ownerSub);
}
