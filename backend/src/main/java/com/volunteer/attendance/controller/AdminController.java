package com.volunteer.attendance.controller;

import com.volunteer.attendance.entity.LuckyDrawEntry;
import com.volunteer.attendance.repository.AttendanceRepository;
import com.volunteer.attendance.repository.BulkDrawRepository;
import com.volunteer.attendance.repository.LuckyDrawRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AdminController {

    private final AttendanceRepository attendanceRepository;
    private final LuckyDrawRepository luckyDrawRepository;
    private final BulkDrawRepository bulkDrawRepository;

    /** Clear attendance + lucky_draw + bulk_draw_selection */
    @DeleteMapping("/attendance")
    public ResponseEntity<?> clearAllAttendance() {
        long count = attendanceRepository.count();
        attendanceRepository.deleteAll();
        luckyDrawRepository.deleteAll();
        bulkDrawRepository.deleteAll();
        return ResponseEntity.ok(Map.of("message", "Cleared " + count + " attendance records and reset all lucky draw data"));
    }

    /** Full reset — attendance + lucky_draw + bulk_draw_selection */
    @DeleteMapping("/all")
    public ResponseEntity<?> clearAll() {
        long attendance = attendanceRepository.count();
        attendanceRepository.deleteAll();
        luckyDrawRepository.deleteAll();
        bulkDrawRepository.deleteAll();
        return ResponseEntity.ok(Map.of("message", "Cleared " + attendance + " attendance records and all lucky draw data"));
    }

    /**
     * Re-sync lucky_draw from attendance — inserts a PENDING entry for every
     * attended participant who doesn't already have a lucky_draw row.
     * Safe to call any time; never deletes existing entries.
     */
    @PostMapping("/reload-lucky-draw")
    public ResponseEntity<?> reloadLuckyDraw() {
        Set<String> existing = luckyDrawRepository.findAll()
                .stream()
                .map(e -> e.getParticipantName())
                .collect(Collectors.toSet());

        long added = attendanceRepository.findAll().stream()
                .filter(a -> !existing.contains(a.getParticipantName()))
                .peek(a -> {
                    LuckyDrawEntry entry = new LuckyDrawEntry();
                    entry.setParticipantName(a.getParticipantName());
                    entry.setSubCommittee(a.getSubCommittee());
                    entry.setStatus(LuckyDrawEntry.Status.PENDING);
                    luckyDrawRepository.save(entry);
                })
                .count();

        return ResponseEntity.ok(Map.of(
                "message", "Lucky draw reloaded — " + added + " participant(s) added"
        ));
    }
}
