package com.volunteer.attendance.controller;

import com.volunteer.attendance.entity.LuckyDrawWinner;
import com.volunteer.attendance.repository.LuckyDrawWinnerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/lucky-draw")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class LuckyDrawController {

    private final LuckyDrawWinnerRepository repo;

    @GetMapping
    public ResponseEntity<List<LuckyDrawWinner>> getWinners() {
        return ResponseEntity.ok(repo.findAllByOrderByDrawnAtDesc());
    }

    @PostMapping
    public ResponseEntity<?> addWinner(@RequestBody Map<String, String> body) {
        String name = body.get("participantName");
        String sub  = body.get("subCommittee");
        if (repo.existsByParticipantName(name)) {
            return ResponseEntity.badRequest().body(Map.of("error", name + " is already a winner"));
        }
        LuckyDrawWinner w = new LuckyDrawWinner();
        w.setParticipantName(name);
        w.setSubCommittee(sub);
        return ResponseEntity.ok(repo.save(w));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> removeWinner(@PathVariable Long id) {
        repo.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping
    public ResponseEntity<?> clearAll() {
        repo.deleteAll();
        return ResponseEntity.ok().build();
    }
}
