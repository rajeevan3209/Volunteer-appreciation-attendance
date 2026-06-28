package com.volunteer.attendance.repository;

import com.volunteer.attendance.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AttendanceRepository extends JpaRepository<Attendance, Long> {

    boolean existsByParticipantName(String participantName);

    List<Attendance> findAllByOrderByMarkedAtDesc();
}
