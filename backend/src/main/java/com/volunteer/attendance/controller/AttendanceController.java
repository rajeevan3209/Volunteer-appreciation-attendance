package com.volunteer.attendance.controller;

import com.volunteer.attendance.entity.Attendance;
import com.volunteer.attendance.service.AttendanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AttendanceController {

    private final AttendanceService attendanceService;

    @GetMapping("/subcommittees")
    public ResponseEntity<List<String>> getSubCommittees() {
        return ResponseEntity.ok(attendanceService.getSubCommittees());
    }

    @GetMapping("/participants/count")
    public ResponseEntity<Map<String, Long>> getParticipantCount() {
        return ResponseEntity.ok(Map.of("total", attendanceService.getTotalParticipants()));
    }

    @GetMapping("/participants")
    public ResponseEntity<List<Map<String, Object>>> getParticipants(
            @RequestParam String subCommittee) {
        return ResponseEntity.ok(attendanceService.getParticipantsBySubCommittee(subCommittee));
    }

    @PostMapping("/attendance")
    public ResponseEntity<?> markAttendance(@RequestBody Map<String, String> body) {
        try {
            String participantName = body.get("participantName");
            String subCommittee = body.get("subCommittee");
            Attendance saved = attendanceService.markAttendance(participantName, subCommittee);
            return ResponseEntity.ok(saved);
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/attendance")
    public ResponseEntity<List<Attendance>> getAllAttendance() {
        return ResponseEntity.ok(attendanceService.getAllAttendance());
    }

    @PostMapping("/participants")
    public ResponseEntity<?> addParticipant(@RequestBody Map<String, String> body) {
        String name = body.get("name");
        String subCommittee = body.get("subCommittee");
        if (name == null || name.isBlank() || subCommittee == null || subCommittee.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name and sub-committee are required."));
        }
        try {
            Map<String, Object> result = attendanceService.addParticipant(name.trim(), subCommittee.trim());
            return ResponseEntity.ok(result);
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
