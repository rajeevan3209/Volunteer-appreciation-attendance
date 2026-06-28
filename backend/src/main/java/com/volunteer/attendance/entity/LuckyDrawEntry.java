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
public class LuckyDrawEntry {

    public enum Status { PENDING, WINNER, EXCLUDED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String participantName;

    @Column(nullable = false)
    private String subCommittee;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.PENDING;

    @Column(nullable = false)
    private LocalDateTime attendedAt;

    private LocalDateTime drawnAt;

    @PrePersist
    protected void onCreate() {
        if (attendedAt == null) attendedAt = LocalDateTime.now();
        if (status == null) status = Status.PENDING;
    }
}
