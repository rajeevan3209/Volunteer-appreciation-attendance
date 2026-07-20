package com.volunteer.attendance.config;

import com.opencsv.CSVReader;
import com.volunteer.attendance.entity.Participant;
import com.volunteer.attendance.repository.ParticipantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStreamReader;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataLoader implements CommandLineRunner {

    private final ParticipantRepository participantRepository;

    @Override
    public void run(String... args) throws Exception {
        if (participantRepository.count() > 0) {
            log.info("Participants already loaded, skipping CSV import.");
            return;
        }
        loadFromCsv();
    }

    public int loadFromCsv() throws Exception {
        participantRepository.deleteAll();
        try (CSVReader reader = new CSVReader(
                new InputStreamReader(new ClassPathResource("participants.xlsx").getInputStream()))) {

            String[] line;
            int count = 0;

            while ((line = reader.readNext()) != null) {
                if (line.length >= 2) {
                    String name = line[0].trim();
                    String subCommittee = line[1].trim();
                    if (!name.isEmpty() && !subCommittee.isEmpty()) {
                        participantRepository.save(new Participant(null, name, subCommittee));
                        count++;
                    }
                }
            }
            log.info("Loaded {} participants from CSV.", count);
            return count;
        }
    }
}
