package com.volunteer.attendance.repository;

import com.volunteer.attendance.entity.LuckyDrawEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LuckyDrawRepository extends JpaRepository<LuckyDrawEntry, Long> {
    List<LuckyDrawEntry> findByStatusOrderByAttendedAtAsc(LuckyDrawEntry.Status status);
    List<LuckyDrawEntry> findAllByOrderByAttendedAtAsc();
    boolean existsByParticipantName(String participantName);
}
