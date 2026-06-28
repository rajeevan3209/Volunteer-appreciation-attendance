package com.volunteer.attendance.repository;

import com.volunteer.attendance.entity.Participant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ParticipantRepository extends JpaRepository<Participant, Long> {

    List<Participant> findBySubCommitteeOrderByNameAsc(String subCommittee);

    @Query("SELECT DISTINCT p.subCommittee FROM Participant p ORDER BY p.subCommittee ASC")
    List<String> findDistinctSubCommittees();

    boolean existsByName(String name);
}
