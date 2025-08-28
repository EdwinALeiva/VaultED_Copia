package com;

import com.vaultedge.model.User;
import com.vaultedge.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class VaultEdgeApplication {
    public static void main(String[] args) {
        SpringApplication.run(VaultEdgeApplication.class, args);
    }

    @Bean
    CommandLineRunner initDatabase(UserRepository userRepository) {
        return args -> {
            User user1 = new User();
            user1.setUsername("demo");
            user1.setPassword("123");
            user1.setEmail("demo@example.com");
            user1.setFirstName("Demo");
            user1.setLastName("User");
            user1.setRole("USER");

            userRepository.save(user1);
        };
    }
}
