package com.volunteer.attendance.controller;

import com.volunteer.attendance.repository.AttendanceRepository;
import com.volunteer.attendance.repository.LuckyDrawWinnerRepository;
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
    private final LuckyDrawWinnerRepository luckyDrawWinnerRepository;

    @DeleteMapping("/attendance")
    public ResponseEntity<?> clearAllAttendance() {
        long count = attendanceRepository.count();
        attendanceRepository.deleteAll();
        return ResponseEntity.ok(Map.of("message", "Cleared " + count + " attendance records"));
    }

    @DeleteMapping("/lucky-draw")
    public ResponseEntity<?> clearLuckyDraw() {
        long count = luckyDrawWinnerRepository.count();
        luckyDrawWinnerRepository.deleteAll();
        return ResponseEntity.ok(Map.of("message", "Cleared " + count + " lucky draw records"));
    }

    @DeleteMapping("/all")
    public ResponseEntity<?> clearAll() {
        long attendance = attendanceRepository.count();
        long lucky = luckyDrawWinnerRepository.count();
        attendanceRepository.deleteAll();
        luckyDrawWinnerRepository.deleteAll();
        return ResponseEntity.ok(Map.of(
            "message", "Cleared " + attendance + " attendance and " + lucky + " lucky draw records"
        ));
    }
}
