package com.studytracker.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * One-time migration: sessions were originally stored in UTC (toISOString from JS).
 * This corrects them to Istanbul local time (UTC+3) by adding 3 hours.
 * Runs automatically on startup; the migration_flags table prevents re-execution.
 */
@Component
public class TimezoneMigration implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    public TimezoneMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        jdbcTemplate.execute(
            "CREATE TABLE IF NOT EXISTS migration_flags " +
            "(flag_name VARCHAR(100) NOT NULL PRIMARY KEY, run_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
        );

        Integer already = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM migration_flags WHERE flag_name = 'timezone_utc_to_istanbul_v1'",
            Integer.class
        );

        if (already == null || already == 0) {
            int rows = jdbcTemplate.update(
                "UPDATE study_sessions " +
                "SET start_time = DATE_ADD(start_time, INTERVAL 3 HOUR), " +
                "    end_time   = DATE_ADD(end_time,   INTERVAL 3 HOUR)"
            );
            jdbcTemplate.update(
                "INSERT INTO migration_flags (flag_name) VALUES ('timezone_utc_to_istanbul_v1')"
            );
            System.out.println(
                "[Migration] timezone_utc_to_istanbul_v1: " + rows +
                " session(s) corrected — UTC times shifted to Istanbul (Europe/Istanbul, +3h)"
            );
        }
    }
}
