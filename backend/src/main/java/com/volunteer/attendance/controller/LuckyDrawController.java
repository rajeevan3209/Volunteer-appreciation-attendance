package com.volunteer.attendance.controller;

import com.volunteer.attendance.entity.LuckyDrawEntry;
import com.volunteer.attendance.repository.LuckyDrawRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/lucky-draw")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class LuckyDrawController {

    private final LuckyDrawRepository repo;

    /** All entries (wheel + winners + excluded) */
    @GetMapping
    public ResponseEntity<List<LuckyDrawEntry>> getAll() {
        return ResponseEntity.ok(repo.findAllByOrderByAttendedAtAsc());
    }

    /** Only PENDING entries (the wheel) */
    @GetMapping("/pending")
    public ResponseEntity<List<LuckyDrawEntry>> getPending() {
        return ResponseEntity.ok(repo.findByStatusOrderByAttendedAtAsc(LuckyDrawEntry.Status.PENDING));
    }

    /** Only WINNER entries (side panel) */
    @GetMapping("/winners")
    public ResponseEntity<List<LuckyDrawEntry>> getWinners() {
        return ResponseEntity.ok(repo.findByStatusOrderByAttendedAtAsc(LuckyDrawEntry.Status.WINNER));
    }

    /** Accept winner — mark as WINNER */
    @PatchMapping("/{id}/accept")
    public ResponseEntity<?> acceptWinner(@PathVariable Long id) {
        return repo.findById(id).map(e -> {
            e.setStatus(LuckyDrawEntry.Status.WINNER);
            e.setDrawnAt(LocalDateTime.now());
            return ResponseEntity.ok(repo.save(e));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Exclude — mark as EXCLUDED, won't appear on wheel */
    @PatchMapping("/{id}/exclude")
    public ResponseEntity<?> excludeEntry(@PathVariable Long id) {
        return repo.findById(id).map(e -> {
            e.setStatus(LuckyDrawEntry.Status.EXCLUDED);
            return ResponseEntity.ok(repo.save(e));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Clear all lucky draw data */
    @DeleteMapping
    public ResponseEntity<?> clearAll() {
        repo.deleteAll();
        return ResponseEntity.ok(Map.of("message", "Lucky draw cleared"));
    }
}
