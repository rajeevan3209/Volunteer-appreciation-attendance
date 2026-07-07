package com.volunteer.attendance.controller;

import com.volunteer.attendance.entity.LuckyDrawEntry;
import com.volunteer.attendance.repository.AttendanceRepository;
import com.volunteer.attendance.repository.BulkDrawRepository;
import com.volunteer.attendance.repository.LuckyDrawRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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
     * Full lucky draw reset — clears all lucky_draw and bulk_draw_selection rows,
     * then re-populates lucky_draw from attendance with everyone as PENDING.
     * Use to restart the draw from scratch after a mistake.
     */
    @PostMapping("/reload-lucky-draw")
    public ResponseEntity<?> reloadLuckyDraw() {
        luckyDrawRepository.deleteAll();
        bulkDrawRepository.deleteAll();

        List<com.volunteer.attendance.entity.Attendance> all = attendanceRepository.findAll();
        all.forEach(a -> {
            LuckyDrawEntry entry = new LuckyDrawEntry();
            entry.setParticipantName(a.getParticipantName());
            entry.setSubCommittee(a.getSubCommittee());
            entry.setStatus(LuckyDrawEntry.Status.PENDING);
            luckyDrawRepository.save(entry);
        });

        return ResponseEntity.ok(Map.of(
                "message", "Lucky draw reset — " + all.size() + " participant(s) reloaded. All previous results cleared."
        ));
    }
}
