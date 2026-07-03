package com.volunteer.attendance.repository;

import com.volunteer.attendance.entity.BulkDrawSelection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface BulkDrawRepository extends JpaRepository<BulkDrawSelection, Long> {

    List<BulkDrawSelection> findAllByOrderByRoundNumAscRankInRoundAsc();

    @Query("SELECT COALESCE(MAX(b.roundNum), 0) FROM BulkDrawSelection b")
    Integer findMaxRoundNum();
}
