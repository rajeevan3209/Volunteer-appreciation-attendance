package com.volunteer.attendance.repository;

import com.volunteer.attendance.entity.LuckyDrawWinner;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LuckyDrawWinnerRepository extends JpaRepository<LuckyDrawWinner, Long> {
    List<LuckyDrawWinner> findAllByOrderByDrawnAtDesc();
    boolean existsByParticipantName(String participantName);
}
