package com.studytracker.repository;

import com.studytracker.entity.StudySession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface StudySessionRepository extends JpaRepository<StudySession, Long> {

    List<StudySession> findByTopicId(Long topicId);

    // ── Per-topic aggregates ─────────────────────────────────────────────────
    @Query("SELECT COALESCE(SUM(ss.durationSeconds), 0) FROM StudySession ss WHERE ss.topic.id = :topicId")
    Long sumDurationByTopicId(@Param("topicId") Long topicId);

    @Query("SELECT MAX(ss.endTime) FROM StudySession ss WHERE ss.topic.id = :topicId")
    Optional<LocalDateTime> findLastSessionEndTimeByTopicId(@Param("topicId") Long topicId);

    // ── Total time per course ────────────────────────────────────────────────
    @Query("SELECT COALESCE(SUM(ss.durationSeconds), 0) FROM StudySession ss WHERE ss.topic.course.id = :courseId")
    Long sumDurationByCourseId(@Param("courseId") Long courseId);

    // ── All sessions by owner ────────────────────────────────────────────────
    @Query("SELECT ss FROM StudySession ss WHERE ss.topic.course.ownerSub = :ownerSub")
    List<StudySession> findAllByOwnerSub(@Param("ownerSub") String ownerSub);

    // ── Today's total (owner-scoped) ─────────────────────────────────────────
    @Query("SELECT COALESCE(SUM(ss.durationSeconds), 0) FROM StudySession ss " +
           "WHERE ss.startTime >= :startOfDay AND ss.startTime < :endOfDay " +
           "AND ss.topic.course.ownerSub = :ownerSub")
    Long sumTodayTotal(@Param("startOfDay") LocalDateTime startOfDay,
                       @Param("endOfDay")   LocalDateTime endOfDay,
                       @Param("ownerSub")   String ownerSub);

    // ── Chart data: all courses, since a given date ──────────────────────────
    @Query(value = """
            SELECT DATE(ss.start_time)        AS study_date,
                   t.course_id                AS course_id,
                   SUM(ss.duration_seconds)   AS total_seconds
            FROM   study_sessions ss
            JOIN   topics t  ON ss.topic_id   = t.id
            JOIN   courses c ON t.course_id   = c.id
            WHERE  ss.start_time >= :startDate
              AND  c.owner_sub = :ownerSub
            GROUP  BY DATE(ss.start_time), t.course_id
            ORDER  BY DATE(ss.start_time) ASC
            """, nativeQuery = true)
    List<Object[]> findChartDataSince(@Param("startDate") LocalDateTime startDate,
                                      @Param("ownerSub")  String ownerSub);

    // ── Chart data: filtered by courseId, since a given date ─────────────────
    @Query(value = """
            SELECT DATE(ss.start_time)        AS study_date,
                   t.course_id                AS course_id,
                   SUM(ss.duration_seconds)   AS total_seconds
            FROM   study_sessions ss
            JOIN   topics t  ON ss.topic_id   = t.id
            JOIN   courses c ON t.course_id   = c.id
            WHERE  ss.start_time >= :startDate
              AND  t.course_id = :courseId
              AND  c.owner_sub = :ownerSub
            GROUP  BY DATE(ss.start_time), t.course_id
            ORDER  BY DATE(ss.start_time) ASC
            """, nativeQuery = true)
    List<Object[]> findChartDataByCourseIdSince(@Param("startDate") LocalDateTime startDate,
                                                @Param("courseId")  Long courseId,
                                                @Param("ownerSub")  String ownerSub);

    // ── Chart data: all courses, between two dates ───────────────────────────
    @Query(value = """
            SELECT DATE(ss.start_time)        AS study_date,
                   t.course_id                AS course_id,
                   SUM(ss.duration_seconds)   AS total_seconds
            FROM   study_sessions ss
            JOIN   topics t  ON ss.topic_id   = t.id
            JOIN   courses c ON t.course_id   = c.id
            WHERE  ss.start_time BETWEEN :startDate AND :endDate
              AND  c.owner_sub = :ownerSub
            GROUP  BY DATE(ss.start_time), t.course_id
            ORDER  BY DATE(ss.start_time) ASC
            """, nativeQuery = true)
    List<Object[]> findChartDataBetween(@Param("startDate") LocalDateTime startDate,
                                        @Param("endDate")   LocalDateTime endDate,
                                        @Param("ownerSub")  String ownerSub);

    // ── Chart data: filtered by courseId, between two dates ──────────────────
    @Query(value = """
            SELECT DATE(ss.start_time)        AS study_date,
                   t.course_id                AS course_id,
                   SUM(ss.duration_seconds)   AS total_seconds
            FROM   study_sessions ss
            JOIN   topics t  ON ss.topic_id   = t.id
            JOIN   courses c ON t.course_id   = c.id
            WHERE  ss.start_time BETWEEN :startDate AND :endDate
              AND  t.course_id = :courseId
              AND  c.owner_sub = :ownerSub
            GROUP  BY DATE(ss.start_time), t.course_id
            ORDER  BY DATE(ss.start_time) ASC
            """, nativeQuery = true)
    List<Object[]> findChartDataByCourseIdBetween(@Param("startDate") LocalDateTime startDate,
                                                  @Param("endDate")   LocalDateTime endDate,
                                                  @Param("courseId")  Long courseId,
                                                  @Param("ownerSub")  String ownerSub);

    // ── Yearly chart: all courses, grouped by month ──────────────────────────
    @Query(value = """
            SELECT DATE_FORMAT(ss.start_time, '%Y-%m')  AS study_month,
                   t.course_id                           AS course_id,
                   SUM(ss.duration_seconds)              AS total_seconds
            FROM   study_sessions ss
            JOIN   topics t  ON ss.topic_id   = t.id
            JOIN   courses c ON t.course_id   = c.id
            WHERE  YEAR(ss.start_time) = :year
              AND  c.owner_sub = :ownerSub
            GROUP  BY DATE_FORMAT(ss.start_time, '%Y-%m'), t.course_id
            ORDER  BY study_month ASC
            """, nativeQuery = true)
    List<Object[]> findYearlyChartData(@Param("year")     int year,
                                       @Param("ownerSub") String ownerSub);

    // ── Yearly chart: filtered by courseId ───────────────────────────────────
    @Query(value = """
            SELECT DATE_FORMAT(ss.start_time, '%Y-%m')  AS study_month,
                   t.course_id                           AS course_id,
                   SUM(ss.duration_seconds)              AS total_seconds
            FROM   study_sessions ss
            JOIN   topics t  ON ss.topic_id   = t.id
            JOIN   courses c ON t.course_id   = c.id
            WHERE  YEAR(ss.start_time) = :year
              AND  t.course_id = :courseId
              AND  c.owner_sub = :ownerSub
            GROUP  BY DATE_FORMAT(ss.start_time, '%Y-%m'), t.course_id
            ORDER  BY study_month ASC
            """, nativeQuery = true)
    List<Object[]> findYearlyChartDataByCourse(@Param("year")     int year,
                                               @Param("courseId") Long courseId,
                                               @Param("ownerSub") String ownerSub);
}
