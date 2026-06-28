package com.volunteer.attendance.service;

import com.volunteer.attendance.entity.Attendance;
import com.volunteer.attendance.entity.LuckyDrawEntry;
import com.volunteer.attendance.entity.Participant;
import com.volunteer.attendance.repository.AttendanceRepository;
import com.volunteer.attendance.repository.LuckyDrawRepository;
import com.volunteer.attendance.repository.ParticipantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AttendanceService {

    private final ParticipantRepository participantRepository;
    private final AttendanceRepository attendanceRepository;
    private final LuckyDrawRepository luckyDrawRepository;

    public List<String> getSubCommittees() {
        return participantRepository.findDistinctSubCommittees();
    }

    public List<Map<String, Object>> getParticipantsBySubCommittee(String subCommittee) {
        List<Participant> participants = participantRepository.findBySubCommitteeOrderByNameAsc(subCommittee);
        Set<String> attended = attendanceRepository.findAll()
                .stream()
                .map(Attendance::getParticipantName)
                .collect(Collectors.toSet());

        return participants.stream().map(p -> Map.<String, Object>of(
                "id", p.getId(),
                "name", p.getName(),
                "subCommittee", p.getSubCommittee(),
                "attended", attended.contains(p.getName())
        )).collect(Collectors.toList());
    }

    @Transactional
    public Attendance markAttendance(String participantName, String subCommittee) {
        if (attendanceRepository.existsByParticipantName(participantName)) {
            throw new IllegalStateException("Attendance already marked for: " + participantName);
        }

        // Save attendance record
        Attendance attendance = new Attendance();
        attendance.setParticipantName(participantName);
        attendance.setSubCommittee(subCommittee);
        Attendance saved = attendanceRepository.save(attendance);

        // Also insert into lucky draw as PENDING (if not already there)
        if (!luckyDrawRepository.existsByParticipantName(participantName)) {
            LuckyDrawEntry entry = new LuckyDrawEntry();
            entry.setParticipantName(participantName);
            entry.setSubCommittee(subCommittee);
            entry.setStatus(LuckyDrawEntry.Status.PENDING);
            luckyDrawRepository.save(entry);
        }

        return saved;
    }

    public List<Attendance> getAllAttendance() {
        return attendanceRepository.findAllByOrderByMarkedAtDesc();
    }
}
