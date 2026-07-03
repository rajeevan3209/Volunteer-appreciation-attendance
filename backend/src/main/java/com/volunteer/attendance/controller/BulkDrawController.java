package com.volunteer.attendance.controller;

import com.volunteer.attendance.entity.BulkDrawSelection;
import com.volunteer.attendance.repository.BulkDrawRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bulk-draw")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class BulkDrawController {

    private final BulkDrawRepository repo;

    /** All selections ordered by round then rank */
    @GetMapping
    public ResponseEntity<List<BulkDrawSelection>> getAll() {
        return ResponseEntity.ok(repo.findAllByOrderByRoundNumAscRankInRoundAsc());
    }

    /** Highest round number currently stored (0 if none) */
    @GetMapping("/max-round")
    public ResponseEntity<Map<String, Integer>> getMaxRound() {
        return ResponseEntity.ok(Map.of("maxRound", repo.findMaxRoundNum()));
    }

    /** Save one winner picked during a bulk spin */
    @PostMapping
    public ResponseEntity<BulkDrawSelection> addSelection(@RequestBody BulkDrawSelection selection) {
        return ResponseEntity.ok(repo.save(selection));
    }

    /** Clear all bulk draw history */
    @DeleteMapping
    public ResponseEntity<?> clearAll() {
        repo.deleteAll();
        return ResponseEntity.ok(Map.of("message", "Bulk draw cleared"));
    }
}
