package com.volunteer.attendance.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "lucky_draw")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LuckyDrawWinner {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String participantName;

    @Column(nullable = false)
    private String subCommittee;

    @Column(nullable = false)
    private LocalDateTime drawnAt;

    @PrePersist
    protected void onCreate() {
        drawnAt = LocalDateTime.now();
    }
}
