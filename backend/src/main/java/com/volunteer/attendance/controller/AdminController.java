package com.volunteer.attendance.controller;

import com.volunteer.attendance.repository.AttendanceRepository;
import com.volunteer.attendance.repository.LuckyDrawRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AdminController {

    private final AttendanceRepository attendanceRepository;
    private final LuckyDrawRepository luckyDrawRepository;

    /** Clear all attendance + lucky draw so participants can re-register */
    @DeleteMapping("/attendance")
    public ResponseEntity<?> clearAllAttendance() {
        long count = attendanceRepository.count();
        attendanceRepository.deleteAll();
        luckyDrawRepository.deleteAll();
        return ResponseEntity.ok(Map.of("message", "Cleared " + count + " attendance records and reset lucky draw"));
    }

    /** Full reset — attendance + lucky draw */
    @DeleteMapping("/all")
    public ResponseEntity<?> clearAll() {
        long attendance = attendanceRepository.count();
        attendanceRepository.deleteAll();
        luckyDrawRepository.deleteAll();
        return ResponseEntity.ok(Map.of("message", "Cleared " + attendance + " attendance records and all lucky draw data"));
    }
}
