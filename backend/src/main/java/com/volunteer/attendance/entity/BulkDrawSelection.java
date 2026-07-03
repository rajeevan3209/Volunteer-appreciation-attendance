package com.volunteer.attendance.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "bulk_draw_selection")
@Data
@NoArgsConstructor
public class BulkDrawSelection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Integer roundNum;

    @Column(nullable = false)
    private Integer rankInRound;

    @Column(nullable = false)
    private String participantName;

    @Column(nullable = false)
    private String subCommittee;

    @Column(nullable = false)
    private LocalDateTime selectedAt;

    @PrePersist
    protected void onCreate() {
        if (selectedAt == null) selectedAt = LocalDateTime.now();
    }
}
